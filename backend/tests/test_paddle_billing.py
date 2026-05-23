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


def subscription_payload(
    *,
    subscription_id: str,
    user_id: int,
    status_value: str,
    period_end: datetime | None,
    customer_id: str = "ctm_test_customer",
    scheduled_action: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": subscription_id,
        "customer_id": customer_id,
        "status": status_value,
        "custom_data": {"user_id": str(user_id), "provider": "paddle"},
    }
    if period_end is not None:
        payload["current_billing_period"] = {
            "starts_at": (period_end - timedelta(days=30)).isoformat() + "Z",
            "ends_at": period_end.isoformat() + "Z",
        }
    if scheduled_action is not None:
        payload["scheduled_change"] = {
            "action": scheduled_action,
            "effective_at": (period_end or datetime.utcnow()).isoformat() + "Z",
        }
    return payload


def subscription_event(event_type: str, subscription: dict[str, Any], event_id: str) -> dict[str, Any]:
    return {
        "event_id": event_id,
        "event_type": event_type,
        "data": subscription,
    }


def test_invalid_signature_is_rejected() -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()
    sub = subscription_payload(
        subscription_id="sub_invalid",
        user_id=user.id,
        status_value="active",
        period_end=datetime.utcnow() + timedelta(days=30),
    )
    event = subscription_event("subscription.activated", sub, "ntf_invalid")

    response = post_paddle_webhook(client, event, signature="ts=123;h1=deadbeef")
    assert response.status_code == 400

    refreshed = fetch_user(user.id)
    assert refreshed.paddle_subscription_id is None
    assert is_pro(refreshed) is False


def test_subscription_activated_grants_pro() -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()
    period_end = datetime.utcnow() + timedelta(days=30)
    sub = subscription_payload(
        subscription_id="sub_active",
        user_id=user.id,
        status_value="active",
        period_end=period_end,
    )

    response = post_paddle_webhook(
        client,
        subscription_event("subscription.activated", sub, "ntf_active"),
    )
    assert response.status_code == 200

    refreshed = fetch_user(user.id)
    assert refreshed.plan == "pro"
    assert refreshed.subscription_status == "active"
    assert refreshed.billing_provider == "paddle"
    assert refreshed.paddle_subscription_id == "sub_active"
    assert refreshed.paddle_customer_id == "ctm_test_customer"
    assert refreshed.subscription_current_period_end is not None
    assert is_pro(refreshed) is True


def test_subscription_trialing_grants_pro() -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()
    sub = subscription_payload(
        subscription_id="sub_trial",
        user_id=user.id,
        status_value="trialing",
        period_end=datetime.utcnow() + timedelta(days=14),
    )

    response = post_paddle_webhook(
        client,
        subscription_event("subscription.updated", sub, "ntf_trial"),
    )
    assert response.status_code == 200

    refreshed = fetch_user(user.id)
    assert refreshed.subscription_status == "trialing"
    assert refreshed.plan == "pro"
    assert is_pro(refreshed) is True


def test_subscription_resumed_grants_pro() -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()
    sub = subscription_payload(
        subscription_id="sub_resumed",
        user_id=user.id,
        status_value="active",
        period_end=datetime.utcnow() + timedelta(days=30),
    )

    response = post_paddle_webhook(
        client,
        subscription_event("subscription.resumed", sub, "ntf_resumed"),
    )
    assert response.status_code == 200

    refreshed = fetch_user(user.id)
    assert refreshed.plan == "pro"
    assert is_pro(refreshed) is True


def test_subscription_canceled_with_future_period_end_keeps_access() -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()
    period_end = datetime.utcnow() + timedelta(days=20)
    sub = subscription_payload(
        subscription_id="sub_canceled_future",
        user_id=user.id,
        status_value="canceled",
        period_end=period_end,
    )

    response = post_paddle_webhook(
        client,
        subscription_event("subscription.canceled", sub, "ntf_canceled_future"),
    )
    assert response.status_code == 200

    refreshed = fetch_user(user.id)
    assert refreshed.subscription_status == "canceled"
    assert refreshed.subscription_current_period_end is not None
    assert is_pro(refreshed) is True


def test_subscription_canceled_past_period_end_removes_access() -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()
    period_end = datetime.utcnow() - timedelta(days=2)
    sub = subscription_payload(
        subscription_id="sub_canceled_past",
        user_id=user.id,
        status_value="canceled",
        period_end=period_end,
    )

    response = post_paddle_webhook(
        client,
        subscription_event("subscription.canceled", sub, "ntf_canceled_past"),
    )
    assert response.status_code == 200

    refreshed = fetch_user(user.id)
    assert refreshed.subscription_status == "canceled"
    assert refreshed.plan == "free"
    assert is_pro(refreshed) is False


def test_subscription_paused_revokes_access() -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()
    sub = subscription_payload(
        subscription_id="sub_paused",
        user_id=user.id,
        status_value="paused",
        period_end=datetime.utcnow() + timedelta(days=10),
    )

    response = post_paddle_webhook(
        client,
        subscription_event("subscription.paused", sub, "ntf_paused"),
    )
    assert response.status_code == 200

    refreshed = fetch_user(user.id)
    assert refreshed.subscription_status == "paused"
    assert refreshed.plan == "free"
    assert is_pro(refreshed) is False


def test_subscription_past_due_revokes_access() -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()
    sub = subscription_payload(
        subscription_id="sub_past_due",
        user_id=user.id,
        status_value="past_due",
        period_end=datetime.utcnow() + timedelta(days=10),
    )

    response = post_paddle_webhook(
        client,
        subscription_event("subscription.past_due", sub, "ntf_past_due"),
    )
    assert response.status_code == 200

    refreshed = fetch_user(user.id)
    assert refreshed.subscription_status == "past_due"
    assert refreshed.plan == "free"
    assert is_pro(refreshed) is False


def test_transaction_completed_stores_paddle_ids(monkeypatch) -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()

    def fake_paddle_request(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        if method == "GET" and path == "/subscriptions/sub_initial":
            return {
                "data": {
                    "id": "sub_initial",
                    "customer_id": "ctm_initial",
                    "status": "active",
                    "current_billing_period": {
                        "starts_at": datetime.utcnow().isoformat() + "Z",
                        "ends_at": (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z",
                    },
                }
            }
        raise AssertionError(f"unexpected paddle call: {method} {path}")

    monkeypatch.setattr(paddle_api, "_paddle_request", fake_paddle_request)

    event = {
        "event_id": "ntf_txn_completed",
        "event_type": "transaction.completed",
        "data": {
            "id": "txn_initial",
            "customer_id": "ctm_initial",
            "subscription_id": "sub_initial",
            "custom_data": {
                "user_id": str(user.id),
                "duration_months": 1,
                "provider": "paddle",
                "product": "rentscout_pro_subscription",
                "plan": "1m",
            },
        },
    }

    response = post_paddle_webhook(client, event)
    assert response.status_code == 200

    refreshed = fetch_user(user.id)
    assert refreshed.paddle_transaction_id == "txn_initial"
    assert refreshed.paddle_subscription_id == "sub_initial"
    assert refreshed.paddle_customer_id == "ctm_initial"
    assert refreshed.plan == "pro"
    assert refreshed.subscription_status == "active"
    assert is_pro(refreshed) is True


def test_duplicate_transaction_completed_is_idempotent(monkeypatch) -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()

    def fake_paddle_request(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "data": {
                "id": "sub_dup",
                "customer_id": "ctm_dup",
                "status": "active",
                "current_billing_period": {
                    "starts_at": datetime.utcnow().isoformat() + "Z",
                    "ends_at": (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z",
                },
            }
        }

    monkeypatch.setattr(paddle_api, "_paddle_request", fake_paddle_request)

    event = {
        "event_id": "ntf_dup",
        "event_type": "transaction.completed",
        "data": {
            "id": "txn_dup",
            "customer_id": "ctm_dup",
            "subscription_id": "sub_dup",
            "custom_data": {"user_id": str(user.id), "plan": "1m"},
        },
    }

    first = post_paddle_webhook(client, event)
    assert first.status_code == 200

    second = post_paddle_webhook(client, event)
    assert second.status_code == 200
    assert second.json().get("duplicate") is True


def test_is_pro_helper_covers_all_paths() -> None:
    user = User(
        email="x@example.com",
        email_normalized="x@example.com",
        password_hash="h",
    )

    user.plan = "free"
    user.subscription_status = "inactive"
    assert is_pro(user) is False

    user.plan = "pro"
    user.subscription_status = "active"
    assert is_pro(user) is True

    user.subscription_status = "trialing"
    assert is_pro(user) is True

    # Canceled but with active paid-through date
    user.plan = "free"
    user.subscription_status = "canceled"
    user.subscription_current_period_end = datetime.utcnow() + timedelta(days=5)
    assert is_pro(user) is True

    # Canceled with elapsed period
    user.subscription_current_period_end = datetime.utcnow() - timedelta(days=1)
    assert is_pro(user) is False

    # Legacy pro_expires_at fallback
    user.subscription_current_period_end = None
    user.pro_expires_at = datetime.utcnow() + timedelta(days=2)
    assert is_pro(user) is True


def test_listing_gating_honors_subscription_status_and_period_end() -> None:
    pro_active = create_test_user()
    database = SessionLocal()
    try:
        stored = database.query(User).filter(User.id == pro_active.id).one()
        stored.plan = "pro"
        stored.subscription_status = "active"
        database.commit()
        database.refresh(stored)
        database.expunge(stored)
    finally:
        database.close()
    assert is_pro(stored) is True

    pro_canceled = create_test_user()
    database = SessionLocal()
    try:
        stored = database.query(User).filter(User.id == pro_canceled.id).one()
        stored.subscription_status = "canceled"
        stored.subscription_current_period_end = datetime.utcnow() + timedelta(days=3)
        database.commit()
        database.refresh(stored)
        database.expunge(stored)
    finally:
        database.close()
    assert is_pro(stored) is True

    expired = create_test_user()
    database = SessionLocal()
    try:
        stored = database.query(User).filter(User.id == expired.id).one()
        stored.subscription_status = "canceled"
        stored.subscription_current_period_end = datetime.utcnow() - timedelta(days=3)
        database.commit()
        database.refresh(stored)
        database.expunge(stored)
    finally:
        database.close()
    assert is_pro(stored) is False


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


def test_manage_endpoint_returns_paddle_management_urls(monkeypatch) -> None:
    user = create_test_user()
    database = SessionLocal()
    try:
        stored = database.query(User).filter(User.id == user.id).one()
        stored.paddle_subscription_id = "sub_manage_test"
        stored.subscription_status = "active"
        stored.plan = "pro"
        database.commit()
    finally:
        database.close()

    def fake_paddle_request(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        assert method == "GET"
        assert path == "/subscriptions/sub_manage_test"
        return {
            "data": {
                "id": "sub_manage_test",
                "management_urls": {
                    "cancel": "https://customer-portal.paddle.test/cancel/abc",
                    "update_payment_method": "https://customer-portal.paddle.test/update/abc",
                },
            }
        }

    monkeypatch.setattr(paddle_api, "_paddle_request", fake_paddle_request)

    client = TestClient(app)
    response = client.get("/api/billing/paddle/manage", headers=auth_headers(fetch_user(user.id)))
    assert response.status_code == 200
    body = response.json()
    assert body["cancel_url"] == "https://customer-portal.paddle.test/cancel/abc"
    assert body["update_payment_method_url"] == "https://customer-portal.paddle.test/update/abc"


def test_manage_endpoint_rejects_users_without_subscription() -> None:
    user = create_test_user()
    client = TestClient(app)
    response = client.get("/api/billing/paddle/manage", headers=auth_headers(user))
    assert response.status_code == 400
