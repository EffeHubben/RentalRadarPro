import hashlib
import hmac
import json
import os
import sys
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp(prefix='rentscout-paddle-tests-')}/test.db"
os.environ["JWT_SECRET_KEY"] = "test-paddle-secret-at-least-32-bytes"
os.environ["PAYMENT_PROVIDER"] = "paddle"
os.environ["PADDLE_ENV"] = "sandbox"
os.environ["PADDLE_API_KEY"] = "pdl_test_api_key"
os.environ["PADDLE_WEBHOOK_SECRET_KEY"] = "pdl_ntfset_test_secret"
os.environ["PADDLE_PRO_1M_PRICE_ID"] = "pri_test_1m"
os.environ["PADDLE_PRO_2M_PRICE_ID"] = "pri_test_2m"
os.environ["PADDLE_PRO_3M_PRICE_ID"] = "pri_test_3m"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import paddle as paddle_api
from app.core.config import settings
from app.core.security import create_access_token
from app.core.subscription import is_pro
from app.database.db import SessionLocal, create_database_tables
from app.models.user import PaddleEvent, User


PADDLE_SECRET = "pdl_ntfset_test_secret"


app = FastAPI()
app.include_router(paddle_api.router)


create_database_tables()
settings.payment_provider = "paddle"
settings.paddle_env = "sandbox"
settings.paddle_api_key = "pdl_test_api_key"
settings.paddle_webhook_secret_key = PADDLE_SECRET
settings.paddle_pro_1m_price_id = "pri_test_1m"
settings.paddle_pro_2m_price_id = "pri_test_2m"
settings.paddle_pro_3m_price_id = "pri_test_3m"


def unique_email(prefix: str) -> str:
    return f"{prefix}-{time.time_ns()}@example.com"


def create_test_user() -> User:
    email_address = unique_email("paddle")
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


def fetch_user(user_id: int) -> User:
    database = SessionLocal()
    try:
        user = database.query(User).filter(User.id == user_id).one()
        database.expunge(user)
        return user
    finally:
        database.close()


def reset_paddle_events() -> None:
    database = SessionLocal()
    try:
        database.query(PaddleEvent).delete()
        database.commit()
    finally:
        database.close()


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def sign_payload(payload: bytes, ts: str | None = None) -> str:
    timestamp = ts or str(int(time.time()))
    digest = hmac.new(
        PADDLE_SECRET.encode("utf-8"),
        f"{timestamp}:".encode("utf-8") + payload,
        hashlib.sha256,
    ).hexdigest()
    return f"ts={timestamp};h1={digest}"


def post_paddle_webhook(client: TestClient, event: dict[str, Any], *, signature: str | None = None):
    body = json.dumps(event).encode("utf-8")
    headers = {
        "content-type": "application/json",
        "paddle-signature": signature if signature is not None else sign_payload(body),
    }
    return client.post("/api/billing/paddle/webhook", content=body, headers=headers)


def transaction_completed_event(
    transaction_id: str,
    user_id: int,
    duration_months: int,
    *,
    customer_id: str | None = "ctm_test_customer",
    event_id: str = "ntf_test_event",
) -> dict[str, Any]:
    data: dict[str, Any] = {
        "id": transaction_id,
        "status": "completed",
        "custom_data": {
            "user_id": str(user_id),
            "duration_months": duration_months,
            "provider": "paddle",
            "product": "rentscout_pro_pass",
            "plan": f"{duration_months}m",
        },
    }
    if customer_id:
        data["customer_id"] = customer_id
    return {
        "event_id": event_id,
        "event_type": "transaction.completed",
        "data": data,
    }


def test_invalid_signature_is_rejected() -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()
    event = transaction_completed_event("txn_invalid", user.id, 1)

    response = post_paddle_webhook(client, event, signature="ts=123;h1=deadbeef")
    assert response.status_code == 400

    refreshed = fetch_user(user.id)
    assert refreshed.pro_expires_at is None
    assert is_pro(refreshed) is False


def test_transaction_completed_1m_grants_about_one_month() -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()

    response = post_paddle_webhook(
        client,
        transaction_completed_event("txn_1m", user.id, 1, event_id="ntf_1m"),
    )
    assert response.status_code == 200

    refreshed = fetch_user(user.id)
    assert refreshed.plan == "pro"
    assert refreshed.subscription_status == "active"
    assert refreshed.billing_provider == "paddle"
    assert refreshed.paddle_transaction_id == "txn_1m"
    assert refreshed.paddle_customer_id == "ctm_test_customer"
    assert refreshed.pro_expires_at is not None

    delta = refreshed.pro_expires_at - datetime.utcnow()
    assert timedelta(days=27) < delta < timedelta(days=32)
    assert is_pro(refreshed) is True


def test_transaction_completed_2m_grants_about_two_months() -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()

    response = post_paddle_webhook(
        client,
        transaction_completed_event("txn_2m", user.id, 2, event_id="ntf_2m"),
    )
    assert response.status_code == 200

    refreshed = fetch_user(user.id)
    assert refreshed.pro_expires_at is not None
    delta = refreshed.pro_expires_at - datetime.utcnow()
    assert timedelta(days=57) < delta < timedelta(days=63)


def test_transaction_completed_3m_grants_about_three_months() -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()

    response = post_paddle_webhook(
        client,
        transaction_completed_event("txn_3m", user.id, 3, event_id="ntf_3m"),
    )
    assert response.status_code == 200

    refreshed = fetch_user(user.id)
    assert refreshed.pro_expires_at is not None
    delta = refreshed.pro_expires_at - datetime.utcnow()
    assert timedelta(days=88) < delta < timedelta(days=93)


def test_transaction_completed_stacks_on_existing_pro_expires() -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()

    future = datetime.utcnow() + timedelta(days=20)
    database = SessionLocal()
    try:
        stored = database.query(User).filter(User.id == user.id).one()
        stored.pro_expires_at = future
        stored.plan = "pro"
        stored.subscription_status = "active"
        stored.billing_provider = "paddle"
        database.commit()
        database.refresh(stored)
        baseline_expires = stored.pro_expires_at
    finally:
        database.close()

    response = post_paddle_webhook(
        client,
        transaction_completed_event("txn_3m_stack", user.id, 3, event_id="ntf_3m_stack"),
    )
    assert response.status_code == 200

    refreshed = fetch_user(user.id)
    assert refreshed.pro_expires_at is not None
    delta = refreshed.pro_expires_at - baseline_expires
    assert timedelta(days=88) < delta < timedelta(days=93)


def test_duplicate_transaction_completed_is_idempotent() -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()

    event = transaction_completed_event("txn_dup", user.id, 2, event_id="ntf_dup")

    first = post_paddle_webhook(client, event)
    assert first.status_code == 200
    after_first = fetch_user(user.id)
    assert after_first.pro_expires_at is not None
    first_expires = after_first.pro_expires_at

    second = post_paddle_webhook(client, event)
    assert second.status_code == 200
    assert second.json().get("duplicate") is True

    after_second = fetch_user(user.id)
    assert after_second.pro_expires_at == first_expires


def test_expired_pro_expires_at_is_not_pro() -> None:
    user = User(
        email="expired@example.com",
        email_normalized="expired@example.com",
        password_hash="h",
    )
    user.plan = "free"
    user.subscription_status = "inactive"
    user.pro_expires_at = datetime.utcnow() - timedelta(days=2)
    assert is_pro(user) is False


def test_is_pro_helper_covers_all_paths() -> None:
    user = User(
        email="x@example.com",
        email_normalized="x@example.com",
        password_hash="h",
    )

    user.plan = "free"
    user.subscription_status = "inactive"
    user.pro_expires_at = None
    assert is_pro(user) is False

    user.plan = "pro"
    user.subscription_status = "active"
    assert is_pro(user) is True

    user.plan = "free"
    user.subscription_status = "inactive"
    user.pro_expires_at = datetime.utcnow() + timedelta(days=5)
    assert is_pro(user) is True

    user.pro_expires_at = datetime.utcnow() - timedelta(days=1)
    assert is_pro(user) is False


def test_listing_gating_honors_pro_via_pro_expires_at() -> None:
    """Free, Pro-via-status, Pro-via-pro_expires_at, and expired users gate correctly."""
    free_user = fetch_user(create_test_user().id)
    assert is_pro(free_user) is False

    pro_status_user = create_test_user()
    database = SessionLocal()
    try:
        stored = database.query(User).filter(User.id == pro_status_user.id).one()
        stored.plan = "pro"
        stored.subscription_status = "active"
        database.commit()
        database.refresh(stored)
        database.expunge(stored)
    finally:
        database.close()
    assert is_pro(stored) is True

    pro_expires_user = create_test_user()
    database = SessionLocal()
    try:
        stored = database.query(User).filter(User.id == pro_expires_user.id).one()
        stored.pro_expires_at = datetime.utcnow() + timedelta(days=10)
        database.commit()
        database.refresh(stored)
        database.expunge(stored)
    finally:
        database.close()
    assert is_pro(stored) is True

    expired_user = create_test_user()
    database = SessionLocal()
    try:
        stored = database.query(User).filter(User.id == expired_user.id).one()
        stored.pro_expires_at = datetime.utcnow() - timedelta(days=1)
        database.commit()
        database.refresh(stored)
        database.expunge(stored)
    finally:
        database.close()
    assert is_pro(stored) is False


def test_subscription_events_do_not_change_user_state() -> None:
    """Paddle subscription.* events are log-only in one-time pass mode."""
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()

    # Give them a paid pass first
    post_paddle_webhook(
        client,
        transaction_completed_event("txn_before_sub_event", user.id, 1, event_id="ntf_pre"),
    )
    after_purchase = fetch_user(user.id)
    assert is_pro(after_purchase) is True
    pro_expires_before = after_purchase.pro_expires_at
    assert pro_expires_before is not None

    # subscription.canceled MUST NOT revoke access
    cancel_event = {
        "event_id": "ntf_sub_cancel",
        "event_type": "subscription.canceled",
        "data": {
            "id": "sub_irrelevant",
            "customer_id": "ctm_test_customer",
            "status": "canceled",
            "custom_data": {"user_id": str(user.id)},
        },
    }
    response = post_paddle_webhook(client, cancel_event)
    assert response.status_code == 200
    assert response.json().get("logged") is True

    after_cancel = fetch_user(user.id)
    assert after_cancel.pro_expires_at == pro_expires_before
    assert is_pro(after_cancel) is True


def test_create_checkout_maps_plan_to_price(monkeypatch) -> None:
    captured: list[dict[str, Any]] = []

    def fake_paddle_request(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        captured.append({"method": method, "path": path, "body": body})
        return {
            "data": {
                "id": f"txn_test_{len(captured)}",
                "checkout": {"url": "https://checkout.paddle.test"},
                "customer_id": None,
            }
        }

    monkeypatch.setattr(paddle_api, "_paddle_request", fake_paddle_request)

    client = TestClient(app)
    user = create_test_user()

    for plan, expected_price, expected_duration in (
        ("1m", "pri_test_1m", 1),
        ("2m", "pri_test_2m", 2),
        ("3m", "pri_test_3m", 3),
    ):
        response = client.post(
            "/api/billing/paddle/create-checkout",
            json={"plan": plan},
            headers=auth_headers(user),
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["plan"] == plan
        assert payload["duration_months"] == expected_duration

    assert [call["body"]["items"][0]["price_id"] for call in captured] == [
        "pri_test_1m",
        "pri_test_2m",
        "pri_test_3m",
    ]
    assert [call["body"]["custom_data"]["plan"] for call in captured] == ["1m", "2m", "3m"]
    assert [call["body"]["custom_data"]["duration_months"] for call in captured] == [1, 2, 3]
