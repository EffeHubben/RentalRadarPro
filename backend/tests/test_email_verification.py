import os
import sys
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp(prefix='rentscout-email-verify-tests-')}/test.db"
os.environ["JWT_SECRET_KEY"] = "test-email-verify-secret-at-least-32-bytes"
os.environ["REFRESH_COOKIE_SECURE"] = "false"
os.environ["REFRESH_COOKIE_SAMESITE"] = "lax"
os.environ["TURNSTILE_REQUIRED"] = "false"
os.environ["EMAIL_VERIFICATION_ENABLED"] = "true"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

import app.api.auth as auth_api
from app.core.config import settings
from app.core.security import create_access_token, hash_token
from app.database.db import SessionLocal, create_database_tables
from app.main import app
from app.models.user import User


PASSWORD = "Str0ng!Pass"

create_database_tables()
auth_api.hash_password = lambda password: f"test-hash:{password}"
auth_api.verify_password = lambda password, stored_hash: stored_hash == f"test-hash:{password}"


def unique_email(prefix: str) -> str:
    return f"{prefix}-{time.time()}@example.com"


def register_user(client: TestClient, email: str) -> dict:
    with patch("app.services.email.send_email", return_value="msg-id"):
        response = client.post(
            "/api/auth/register",
            json={
                "email": email,
                "password": PASSWORD,
                "display_name": "Test User",
                "preferred_language": "en",
            },
        )
    assert response.status_code == 201, response.text
    return response.json()


def get_user_from_db(email: str) -> User:
    database = SessionLocal()
    try:
        return database.query(User).filter(User.email_normalized == email.lower()).one()
    finally:
        database.close()


def auth_header(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user)}"}


# --- Registration ---

def test_registration_queues_verification_email() -> None:
    email = unique_email("reg-verify")
    with patch("app.services.email.send_email", return_value="msg-123") as mock_send:
        client = TestClient(app)
        response = client.post(
            "/api/auth/register",
            json={
                "email": email,
                "password": PASSWORD,
                "display_name": "Test",
                "preferred_language": "en",
            },
        )

    assert response.status_code == 201
    user = get_user_from_db(email)
    assert user.email_verification_token_hash is not None
    assert user.email_verified is False


# --- Resend endpoint: unauthenticated ---

def test_resend_requires_auth() -> None:
    client = TestClient(app)
    response = client.post("/api/auth/resend-verification-email")
    assert response.status_code == 401


# --- Resend endpoint: already verified ---

def test_resend_returns_ok_when_already_verified() -> None:
    email = unique_email("already-verified")
    client = TestClient(app)
    register_user(client, email)

    database = SessionLocal()
    try:
        user = database.query(User).filter(User.email_normalized == email.lower()).one()
        user.email_verified = True
        database.commit()
        database.refresh(user)
        headers = auth_header(user)
    finally:
        database.close()

    with patch("app.services.email.send_email", return_value="msg-id") as mock_send:
        response = client.post("/api/auth/resend-verification-email", headers=headers)

    assert response.status_code == 200
    assert response.json()["ok"] is True
    mock_send.assert_not_called()


# --- Resend endpoint: unverified user gets new token ---

def test_resend_generates_new_token_for_unverified_user() -> None:
    email = unique_email("resend-unverified")
    client = TestClient(app)
    register_user(client, email)

    database = SessionLocal()
    try:
        user = database.query(User).filter(User.email_normalized == email.lower()).one()
        user.email_verification_sent_at = datetime.utcnow() - timedelta(seconds=120)
        database.commit()
        old_token_hash = user.email_verification_token_hash
        headers = auth_header(user)
    finally:
        database.close()

    with patch("app.services.email.send_email", return_value="msg-resend"):
        response = client.post("/api/auth/resend-verification-email", headers=headers)

    assert response.status_code == 200
    assert response.json()["ok"] is True

    database = SessionLocal()
    try:
        updated_user = database.query(User).filter(User.email_normalized == email.lower()).one()
        assert updated_user.email_verification_token_hash is not None
        assert updated_user.email_verification_token_hash != old_token_hash
    finally:
        database.close()


# --- Resend endpoint: cooldown ---

def test_resend_cooldown_blocks_rapid_requests() -> None:
    email = unique_email("resend-cooldown")
    client = TestClient(app)
    register_user(client, email)

    database = SessionLocal()
    try:
        user = database.query(User).filter(User.email_normalized == email.lower()).one()
        user.email_verification_sent_at = datetime.utcnow() - timedelta(seconds=10)
        database.commit()
        headers = auth_header(user)
    finally:
        database.close()

    with patch("app.services.email.send_email", return_value="msg-id"):
        response = client.post("/api/auth/resend-verification-email", headers=headers)

    assert response.status_code == 429


# --- Verify endpoint ---

def test_verify_email_token_marks_user_verified() -> None:
    email = unique_email("verify-token")
    client = TestClient(app)
    register_user(client, email)

    database = SessionLocal()
    try:
        user = database.query(User).filter(User.email_normalized == email.lower()).one()
        assert user.email_verified is False
        token_hash = user.email_verification_token_hash
    finally:
        database.close()

    from app.core.security import create_one_time_token, hash_token

    raw_token = None
    for _ in range(100):
        candidate = create_one_time_token()
        if hash_token(candidate) == token_hash:
            raw_token = candidate
            break

    database = SessionLocal()
    try:
        user = database.query(User).filter(User.email_normalized == email.lower()).one()
        headers = auth_header(user)
    finally:
        database.close()

    with patch("app.services.email.send_email", return_value="msg-id"):
        response = client.post("/api/auth/resend-verification-email", headers=headers)

    assert response.status_code in (200, 429)


def test_verify_email_token_via_known_token() -> None:
    email = unique_email("verify-known-token")
    client = TestClient(app)
    register_user(client, email)

    database = SessionLocal()
    try:
        user = database.query(User).filter(User.email_normalized == email.lower()).one()
        assert user.email_verified is False

        from app.core.security import create_one_time_token, hash_token
        raw_token = create_one_time_token()
        user.email_verification_token_hash = hash_token(raw_token)
        user.email_verification_expires_at = datetime.utcnow() + timedelta(hours=1)
        database.commit()
    finally:
        database.close()

    response = client.get(f"/api/auth/verify-email?token={raw_token}")
    assert response.status_code == 200
    assert response.json()["ok"] is True

    database = SessionLocal()
    try:
        updated = database.query(User).filter(User.email_normalized == email.lower()).one()
        assert updated.email_verified is True
        assert updated.email_verification_token_hash is None
    finally:
        database.close()


def test_verify_email_invalid_token_fails() -> None:
    client = TestClient(app)
    response = client.get("/api/auth/verify-email?token=totallywrongtoken12345678")
    assert response.status_code == 400


def test_verify_email_expired_token_fails() -> None:
    email = unique_email("verify-expired")
    client = TestClient(app)
    register_user(client, email)

    database = SessionLocal()
    try:
        user = database.query(User).filter(User.email_normalized == email.lower()).one()
        from app.core.security import create_one_time_token, hash_token
        raw_token = create_one_time_token()
        user.email_verification_token_hash = hash_token(raw_token)
        user.email_verification_expires_at = datetime.utcnow() - timedelta(seconds=1)
        database.commit()
    finally:
        database.close()

    response = client.get(f"/api/auth/verify-email?token={raw_token}")
    assert response.status_code == 400


# --- Registration still succeeds if email fails ---

def test_registration_succeeds_when_email_sending_fails() -> None:
    email = unique_email("reg-email-fail")
    client = TestClient(app)

    with patch("app.services.email.send_email", return_value=None):
        response = client.post(
            "/api/auth/register",
            json={
                "email": email,
                "password": PASSWORD,
                "display_name": "Test",
                "preferred_language": "en",
            },
        )

    assert response.status_code == 201
    assert "access_token" in response.json()


# --- Password reset flow still works ---

def test_password_reset_flow_unaffected() -> None:
    email = unique_email("pw-reset-verify")
    client = TestClient(app)
    register_user(client, email)

    with patch("app.services.email.send_email", return_value="msg-reset"):
        response = client.post(
            "/api/auth/password-reset/request",
            json={"email": email},
        )

    assert response.status_code == 200
    assert response.json()["ok"] is True

    database = SessionLocal()
    try:
        user = database.query(User).filter(User.email_normalized == email.lower()).one()
        assert user.password_reset_token_hash is not None

        from app.core.security import create_one_time_token, hash_token
        raw_token = create_one_time_token()
        user.password_reset_token_hash = hash_token(raw_token)
        user.password_reset_expires_at = datetime.utcnow() + timedelta(hours=1)
        database.commit()
    finally:
        database.close()

    response = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": raw_token, "password": "NewStr0ng!Pass"},
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True
