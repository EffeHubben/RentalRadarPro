import json
import os
import sys
import tempfile
import time
from pathlib import Path
from types import SimpleNamespace
from typing import Any

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp(prefix='rentscout-billing-tests-')}/test.db"
os.environ["JWT_SECRET_KEY"] = "test-billing-secret-at-least-32-bytes"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_placeholder"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test_placeholder"
os.environ["STRIPE_PRICE_ID_PRO"] = "price_test_pro"
os.environ["BILLING_SUCCESS_URL"] = "http://localhost:3000/account?checkout=success"
os.environ["BILLING_CANCEL_URL"] = "http://localhost:3000/#pricing"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

import app.api.billing as billing_api
from app.core.config import settings
from app.core.security import create_access_token
from app.database.db import SessionLocal, create_database_tables
from app.main import app
from app.models.user import User


VALID_SIGNATURE = "valid-test-signature"


class FakeStripe:
    customers_created: list[dict[str, Any]] = []
    checkout_sessions_created: list[dict[str, Any]] = []
    subscriptions: dict[str, dict[str, Any]] = {}

    class Customer:
        @staticmethod
        def create(**kwargs: Any) -> SimpleNamespace:
            FakeStripe.customers_created.append(kwargs)
            return SimpleNamespace(id=f"cus_test_{len(FakeStripe.customers_created)}")

    class checkout:
        class Session:
            @staticmethod
            def create(**kwargs: Any) -> SimpleNamespace:
                FakeStripe.checkout_sessions_created.append(kwargs)
                return SimpleNamespace(url="https://checkout.stripe.test/session")

    class billing_portal:
        class Session:
            @staticmethod
            def create(**kwargs: Any) -> SimpleNamespace:
                return SimpleNamespace(url="https://billing.stripe.test/session")

    class Subscription:
        @staticmethod
        def retrieve(subscription_id: str) -> dict[str, Any]:
            return FakeStripe.subscriptions[subscription_id]

    class Webhook:
        @staticmethod
        def construct_event(payload: bytes, signature: str, webhook_secret: str) -> dict[str, Any]:
            if signature != VALID_SIGNATURE or webhook_secret != "whsec_test_placeholder":
                raise ValueError("invalid signature")
            return json.loads(payload.decode("utf-8"))


def reset_fake_stripe() -> None:
    FakeStripe.customers_created = []
    FakeStripe.checkout_sessions_created = []
    FakeStripe.subscriptions = {}


def unique_email(prefix: str) -> str:
    return f"{prefix}-{time.time()}@example.com"


def create_test_user(email: str | None = None) -> User:
    email_address = email or unique_email("billing")
    database = SessionLocal()
    try:
        user = User(
            email=email_address,
            email_normalized=email_address,
            password_hash="test-hash",
        )
        database.add(user)
        database.commit()
        database.refresh(user)
        database.expunge(user)
        return user
    finally:
        database.close()


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def fetch_user(user_id: int) -> User:
    database = SessionLocal()
    try:
        user = database.query(User).filter(User.id == user_id).one()
        database.expunge(user)
        return user
    finally:
        database.close()


def post_webhook(client: TestClient, event: dict[str, Any], signature: str = VALID_SIGNATURE):
    return client.post(
        "/api/billing/webhook",
        content=json.dumps(event).encode("utf-8"),
        headers={"stripe-signature": signature, "content-type": "application/json"},
    )


create_database_tables()
settings.stripe_secret_key = "sk_test_placeholder"
settings.stripe_webhook_secret = "whsec_test_placeholder"
settings.stripe_price_id_pro = "price_test_pro"
settings.billing_success_url = "http://localhost:3000/account?checkout=success"
settings.billing_cancel_url = "http://localhost:3000/#pricing"
billing_api.get_stripe = lambda: FakeStripe
billing_api.send_pro_activated_email = lambda *args, **kwargs: None
billing_api.send_payment_failed_email = lambda *args, **kwargs: None
billing_api.send_subscription_canceled_email = lambda *args, **kwargs: None


def test_checkout_session_requires_authenticated_user() -> None:
    reset_fake_stripe()
    client = TestClient(app)

    response = client.post("/api/billing/create-checkout-session")

    assert response.status_code == 401
    assert FakeStripe.checkout_sessions_created == []


def test_checkout_session_creates_and_reuses_customer_mapping() -> None:
    reset_fake_stripe()
    user = create_test_user()
    client = TestClient(app)

    first_response = client.post(
        "/api/billing/create-checkout-session",
        headers=auth_headers(user),
    )
    second_response = client.post(
        "/api/billing/create-checkout-session",
        headers=auth_headers(fetch_user(user.id)),
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert first_response.json() == {"url": "https://checkout.stripe.test/session"}
    assert len(FakeStripe.customers_created) == 1
    assert [session["customer"] for session in FakeStripe.checkout_sessions_created] == [
        "cus_test_1",
        "cus_test_1",
    ]

    updated_user = fetch_user(user.id)
    assert updated_user.stripe_customer_id == "cus_test_1"


def test_webhook_rejects_invalid_signature() -> None:
    reset_fake_stripe()
    client = TestClient(app)

    response = post_webhook(
        client,
        {"id": "evt_invalid", "type": "checkout.session.completed", "data": {"object": {}}},
        signature="invalid",
    )

    assert response.status_code == 400


def test_checkout_completed_webhook_upgrades_user_to_pro() -> None:
    reset_fake_stripe()
    user = create_test_user()
    FakeStripe.subscriptions["sub_test_active"] = {
        "id": "sub_test_active",
        "customer": "cus_test_completed",
        "status": "active",
        "current_period_end": 1_900_000_000,
        "cancel_at_period_end": False,
        "metadata": {"user_id": str(user.id)},
    }
    client = TestClient(app)

    response = post_webhook(
        client,
        {
            "id": "evt_checkout_completed",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_completed",
                    "customer": "cus_test_completed",
                    "subscription": "sub_test_active",
                    "metadata": {"user_id": str(user.id)},
                }
            },
        },
    )

    assert response.status_code == 200
    updated_user = fetch_user(user.id)
    assert updated_user.plan == "pro"
    assert updated_user.subscription_status == "active"
    assert updated_user.stripe_customer_id == "cus_test_completed"
    assert updated_user.stripe_subscription_id == "sub_test_active"
    assert updated_user.subscription_current_period_end is not None


def test_subscription_deleted_webhook_downgrades_user() -> None:
    reset_fake_stripe()
    user = create_test_user()
    database = SessionLocal()
    try:
        stored_user = database.query(User).filter(User.id == user.id).one()
        stored_user.plan = "pro"
        stored_user.subscription_status = "active"
        stored_user.stripe_customer_id = "cus_test_deleted"
        stored_user.stripe_subscription_id = "sub_test_deleted"
        database.commit()
    finally:
        database.close()

    client = TestClient(app)
    response = post_webhook(
        client,
        {
            "id": "evt_subscription_deleted",
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "id": "sub_test_deleted",
                    "customer": "cus_test_deleted",
                    "status": "canceled",
                    "current_period_end": 1_900_000_000,
                    "cancel_at_period_end": False,
                }
            },
        },
    )

    assert response.status_code == 200
    updated_user = fetch_user(user.id)
    assert updated_user.plan == "free"
    assert updated_user.subscription_status == "canceled"
    assert updated_user.stripe_subscription_id == "sub_test_deleted"


def test_subscription_updated_canceled_webhook_downgrades_user() -> None:
    reset_fake_stripe()
    user = create_test_user()
    database = SessionLocal()
    try:
        stored_user = database.query(User).filter(User.id == user.id).one()
        stored_user.plan = "pro"
        stored_user.subscription_status = "active"
        stored_user.stripe_customer_id = "cus_test_updated_canceled"
        stored_user.stripe_subscription_id = "sub_test_updated_canceled"
        database.commit()
    finally:
        database.close()

    client = TestClient(app)
    response = post_webhook(
        client,
        {
            "id": "evt_subscription_updated_canceled",
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "id": "sub_test_updated_canceled",
                    "customer": "cus_test_updated_canceled",
                    "status": "canceled",
                    "current_period_end": 1_900_000_000,
                    "cancel_at_period_end": False,
                }
            },
        },
    )

    assert response.status_code == 200
    updated_user = fetch_user(user.id)
    assert updated_user.plan == "free"
    assert updated_user.subscription_status == "canceled"


def test_invoice_payment_failed_webhook_restricts_pro_access() -> None:
    reset_fake_stripe()
    user = create_test_user()
    FakeStripe.subscriptions["sub_test_past_due"] = {
        "id": "sub_test_past_due",
        "customer": "cus_test_failed",
        "status": "past_due",
        "current_period_end": 1_900_000_000,
        "cancel_at_period_end": False,
    }
    database = SessionLocal()
    try:
        stored_user = database.query(User).filter(User.id == user.id).one()
        stored_user.plan = "pro"
        stored_user.subscription_status = "active"
        stored_user.stripe_customer_id = "cus_test_failed"
        stored_user.stripe_subscription_id = "sub_test_past_due"
        database.commit()
    finally:
        database.close()

    client = TestClient(app)
    response = post_webhook(
        client,
        {
            "id": "evt_invoice_failed",
            "type": "invoice.payment_failed",
            "data": {
                "object": {
                    "id": "in_test_failed",
                    "customer": "cus_test_failed",
                    "subscription": "sub_test_past_due",
                }
            },
        },
    )

    assert response.status_code == 200
    updated_user = fetch_user(user.id)
    assert updated_user.plan == "free"
    assert updated_user.subscription_status == "past_due"


def test_duplicate_checkout_completed_webhooks_keep_state_stable() -> None:
    reset_fake_stripe()
    user = create_test_user()
    FakeStripe.subscriptions["sub_test_duplicate"] = {
        "id": "sub_test_duplicate",
        "customer": "cus_test_duplicate",
        "status": "active",
        "current_period_end": 1_900_000_000,
        "cancel_at_period_end": False,
        "metadata": {"user_id": str(user.id)},
    }
    event = {
        "id": "evt_checkout_duplicate",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_duplicate",
                "customer": "cus_test_duplicate",
                "subscription": "sub_test_duplicate",
                "metadata": {"user_id": str(user.id)},
            }
        },
    }
    client = TestClient(app)

    first_response = post_webhook(client, event)
    second_response = post_webhook(client, event)

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    updated_user = fetch_user(user.id)
    assert updated_user.plan == "pro"
    assert updated_user.subscription_status == "active"
    assert updated_user.stripe_customer_id == "cus_test_duplicate"
    assert updated_user.stripe_subscription_id == "sub_test_duplicate"
