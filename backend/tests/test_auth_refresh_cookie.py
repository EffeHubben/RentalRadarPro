import os
import sys
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp(prefix='rentscout-auth-tests-')}/test.db"
os.environ["JWT_SECRET_KEY"] = "test-refresh-cookie-secret-at-least-32-bytes"
os.environ["REFRESH_COOKIE_SECURE"] = "false"
os.environ["REFRESH_COOKIE_SAMESITE"] = "lax"
os.environ["TURNSTILE_REQUIRED"] = "false"
os.environ["EMAIL_VERIFICATION_ENABLED"] = "false"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

import app.api.auth as auth_api
from app.core.config import settings
from app.core.security import create_access_token, hash_refresh_token
from app.database.db import SessionLocal, create_database_tables
from app.main import app
from app.models.user import RefreshToken, User


PASSWORD = "Str0ng!Pass"


create_database_tables()
auth_api.hash_password = lambda password: f"test-hash:{password}"
auth_api.verify_password = lambda password, stored_hash: stored_hash == f"test-hash:{password}"


def unique_email(prefix: str) -> str:
    return f"{prefix}-{time.time()}@example.com"


def register_user(client: TestClient, email: str) -> dict:
    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "display_name": "Cookie Tester",
            "preferred_language": "en",
        },
    )
    assert response.status_code == 201
    return response.json()


def create_user(email: str) -> User:
    client = TestClient(app)
    register_user(client, email)

    database = SessionLocal()
    try:
        return database.query(User).filter(User.email_normalized == email).one()
    finally:
        database.close()


def test_login_sets_refresh_cookie_without_returning_refresh_token() -> None:
    email = unique_email("login-cookie")
    create_user(email)

    client = TestClient(app)
    response = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})

    assert response.status_code == 200
    payload = response.json()
    assert "access_token" in payload
    assert "refresh_token" not in payload

    set_cookie = response.headers["set-cookie"]
    assert f"{settings.auth_refresh_cookie_name}=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert f"Max-Age={settings.auth_refresh_token_days * 24 * 60 * 60}" in set_cookie
    assert f"Path={settings.auth_refresh_cookie_path}" in set_cookie
    assert "SameSite=lax" in set_cookie


def test_register_sets_refresh_cookie_without_returning_refresh_token() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/auth/register",
        json={
            "email": unique_email("register-cookie"),
            "password": PASSWORD,
            "display_name": "Cookie Tester",
            "preferred_language": "en",
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert "access_token" in payload
    assert "refresh_token" not in payload
    assert f"{settings.auth_refresh_cookie_name}=" in response.headers["set-cookie"]
    assert f"Path={settings.auth_refresh_cookie_path}" in response.headers["set-cookie"]


def test_refresh_succeeds_with_valid_cookie() -> None:
    client = TestClient(app)
    register_user(client, unique_email("refresh-valid"))

    response = client.post("/api/auth/refresh")

    assert response.status_code == 200
    payload = response.json()
    assert "access_token" in payload
    assert "refresh_token" not in payload


def test_refresh_fails_without_cookie() -> None:
    client = TestClient(app)

    response = client.post("/api/auth/refresh")

    assert response.status_code == 401


def test_refresh_fails_with_invalid_cookie() -> None:
    client = TestClient(app)
    client.cookies.set(
        settings.auth_refresh_cookie_name,
        "not-a-valid-refresh-token",
        path=settings.auth_refresh_cookie_path,
    )

    response = client.post("/api/auth/refresh")

    assert response.status_code == 401


def test_refresh_fails_with_expired_cookie() -> None:
    client = TestClient(app)
    register_user(client, unique_email("refresh-expired"))
    refresh_token = client.cookies.get(settings.auth_refresh_cookie_name)
    assert refresh_token

    database = SessionLocal()
    try:
        token_record = (
            database.query(RefreshToken)
            .filter(RefreshToken.token_hash == hash_refresh_token(refresh_token))
            .one()
        )
        token_record.expires_at = datetime.utcnow() - timedelta(seconds=1)
        database.commit()
    finally:
        database.close()

    response = client.post("/api/auth/refresh")

    assert response.status_code == 401


def test_refresh_rejects_access_token_in_refresh_cookie() -> None:
    user = create_user(unique_email("refresh-access-token"))
    client = TestClient(app)
    client.cookies.set(
        settings.auth_refresh_cookie_name,
        create_access_token(user),
        path=settings.auth_refresh_cookie_path,
    )

    response = client.post("/api/auth/refresh")

    assert response.status_code == 401


def test_logout_clears_refresh_cookie_and_is_safe_without_cookie() -> None:
    client = TestClient(app)
    register_user(client, unique_email("logout-cookie"))

    response = client.post("/api/auth/logout")

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    set_cookie = response.headers["set-cookie"]
    assert f"{settings.auth_refresh_cookie_name}=" in set_cookie
    assert f"Path={settings.auth_refresh_cookie_path}" in set_cookie
    assert "SameSite=lax" in set_cookie

    response_without_cookie = TestClient(app).post("/api/auth/logout")
    assert response_without_cookie.status_code == 200
    assert response_without_cookie.json() == {"ok": True}
