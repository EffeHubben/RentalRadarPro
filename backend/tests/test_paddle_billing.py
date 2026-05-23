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


app = FastAPI()
app.include_router(paddle_api.router)


PADDLE_SECRET = "pdl_ntfset_test_secret"


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
        },
    }
    if customer_id:
        data["customer_id"] = customer_id
    return {
        "event_id": event_id,
        "event_type": "transaction.completed",
        "data": data,
    }


def test_invalid_paddle_signature_is_rejected() -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()
    event = transaction_completed_event("txn_invalid", user.id, 1)

    response = post_paddle_webhook(client, event, signature="ts=123;h1=deadbeef")
    assert response.status_code == 400

    refreshed = fetch_user(user.id)
    assert refreshed.pro_expires_at is None
    assert is_pro(refreshed) is False


def test_transaction_completed_1m_sets_pro_expires_one_month_ahead() -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()

    response = post_paddle_webhook(
        client,
        transaction_completed_event("txn_1m_basic", user.id, 1, event_id="ntf_1m_basic"),
    )
    assert response.status_code == 200

    refreshed = fetch_user(user.id)
    assert refreshed.plan == "pro"
    assert refreshed.subscription_status == "active"
    assert refreshed.billing_provider == "paddle"
    assert refreshed.paddle_transaction_id == "txn_1m_basic"
    assert refreshed.paddle_customer_id == "ctm_test_customer"
    assert refreshed.pro_expires_at is not None

    delta = refreshed.pro_expires_at - datetime.utcnow()
    assert timedelta(days=27) < delta < timedelta(days=32)
    assert is_pro(refreshed) is True


def test_transaction_completed_3m_stacks_on_existing_pro_expires() -> None:
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


def test_duplicate_transaction_completed_does_not_extend_twice() -> None:
    reset_paddle_events()
    client = TestClient(app)
    user = create_test_user()

    event = transaction_completed_event("txn_dup", user.id, 2, event_id="ntf_dup")

    first = post_paddle_webhook(client, event)
    assert first.status_code == 200

    after_first = fetch_user(user.id)
    first_expires = after_first.pro_expires_at
    assert first_expires is not None

    second = post_paddle_webhook(client, event)
    assert second.status_code == 200
    assert second.json().get("duplicate") is True

    after_second = fetch_user(user.id)
    assert after_second.pro_expires_at == first_expires


def test_is_pro_honors_subscription_status_and_pro_expires_at() -> None:
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
    """A user with pro_expires_at in the future should be Pro for gating purposes."""
    free_user = create_test_user()
    database = SessionLocal()
    try:
        pro_via_status = database.query(User).filter(User.id == free_user.id).one()
        pro_via_status_email = pro_via_status.email_normalized
    finally:
        database.close()

    # Make a second user as pro-via-pro_expires_at
    pro_via_expires = create_test_user()
    database = SessionLocal()
    try:
        stored = database.query(User).filter(User.id == pro_via_expires.id).one()
        stored.pro_expires_at = datetime.utcnow() + timedelta(days=10)
        database.commit()
        database.refresh(stored)
        database.expunge(stored)
        pro_user_obj = stored
    finally:
        database.close()

    # Make a third user with expired pro
    expired_user = create_test_user()
    database = SessionLocal()
    try:
        stored = database.query(User).filter(User.id == expired_user.id).one()
        stored.pro_expires_at = datetime.utcnow() - timedelta(days=1)
        database.commit()
        database.refresh(stored)
        database.expunge(stored)
        expired_user_obj = stored
    finally:
        database.close()

    # Free user (just registered, no pro)
    free_user_obj = fetch_user(free_user.id)
    assert is_pro(free_user_obj) is False
    assert is_pro(pro_user_obj) is True
    assert is_pro(expired_user_obj) is False

    # Pro via subscription_status
    database = SessionLocal()
    try:
        stored = database.query(User).filter(User.id == free_user.id).one()
        stored.plan = "pro"
        stored.subscription_status = "active"
        database.commit()
        database.refresh(stored)
        database.expunge(stored)
        pro_status_user = stored
    finally:
        database.close()
    assert is_pro(pro_status_user) is True


def test_create_checkout_endpoint_calls_paddle_api(monkeypatch) -> None:
    user = create_test_user()
    captured: dict[str, Any] = {}

    def fake_paddle_request(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        captured["method"] = method
        captured["path"] = path
        captured["body"] = body
        return {
            "data": {
                "id": "txn_test_checkout",
                "checkout": {"url": "https://checkout.paddle.test/txn_test_checkout"},
                "customer_id": "ctm_test_new",
            }
        }

    monkeypatch.setattr(paddle_api, "_paddle_request", fake_paddle_request)

    client = TestClient(app)
    response = client.post(
        "/api/billing/paddle/create-checkout",
        json={"plan": "2m"},
        headers=auth_headers(user),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["transaction_id"] == "txn_test_checkout"
    assert payload["checkout_url"] == "https://checkout.paddle.test/txn_test_checkout"
    assert payload["plan"] == "2m"
    assert payload["duration_months"] == 2

    assert captured["method"] == "POST"
    assert captured["path"] == "/transactions"
    assert captured["body"]["items"][0]["price_id"] == "pri_test_2m"
    assert captured["body"]["custom_data"]["user_id"] == str(user.id)
    assert captured["body"]["custom_data"]["duration_months"] == 2

    refreshed = fetch_user(user.id)
    assert refreshed.paddle_customer_id == "ctm_test_new"
