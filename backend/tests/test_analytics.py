import os
import sys
import tempfile
import time
from pathlib import Path

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp(prefix='rentscout-analytics-tests-')}/test.db"
os.environ["JWT_SECRET_KEY"] = "test-analytics-secret-at-least-32-bytes-ok"
os.environ["REFRESH_COOKIE_SECURE"] = "false"
os.environ["REFRESH_COOKIE_SAMESITE"] = "lax"
os.environ["TURNSTILE_REQUIRED"] = "false"
os.environ["EMAIL_VERIFICATION_ENABLED"] = "false"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.database.db import SessionLocal, create_database_tables
from app.main import app
from app.models.user import User
from app.core.security import create_access_token

create_database_tables()

client = TestClient(app)

PASSWORD = "Str0ng!Pass"


def unique_email(prefix: str) -> str:
    return f"{prefix}-{time.time()}@example.com"


def _make_admin_token() -> str:
    db = SessionLocal()
    try:
        email = unique_email("admin-analytics")
        user = User(
            email=email,
            email_normalized=email.lower(),
            password_hash="test-hash",
            is_admin=True,
            email_verified=True,
            plan="pro",
            subscription_status="active",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return create_access_token(user)
    finally:
        db.close()


def test_track_event_valid():
    response = client.post("/api/analytics/event", json={
        "event_type": "page_view",
        "anonymous_session_id": "abc123",
        "path": "/search",
    })
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_track_event_unknown_type_silently_ignored():
    response = client.post("/api/analytics/event", json={
        "event_type": "malicious_event",
        "anonymous_session_id": "abc123",
        "path": "/search",
    })
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_track_event_all_valid_types():
    valid_types = [
        "page_view", "search_view", "listing_view", "open_listing_click",
        "signup_started", "signup_completed", "checkout_started",
        "account_view", "search_filter_used",
    ]
    for event_type in valid_types:
        response = client.post("/api/analytics/event", json={"event_type": event_type})
        assert response.status_code == 200, f"Failed for {event_type}"


def test_track_event_optional_fields():
    response = client.post("/api/analytics/event", json={
        "event_type": "listing_view",
        "anonymous_session_id": "sess-xyz",
        "path": "/listing/123-amsterdam-apartment",
        "listing_id": 123,
        "city": "Amsterdam",
        "referrer_domain": "google.com",
    })
    assert response.status_code == 200


def test_analytics_overview_requires_admin():
    response = client.get("/api/admin/analytics/overview")
    assert response.status_code == 401


def test_analytics_overview_with_admin():
    token = _make_admin_token()
    response = client.get(
        "/api/admin/analytics/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "today" in data
    assert "trend_7d" in data
    today = data["today"]
    for key in ("page_views", "searches", "listing_views", "open_clicks", "unique_sessions", "total_events"):
        assert key in today, f"Missing key: {key}"
    assert len(data["trend_7d"]) == 7


def test_analytics_live_requires_admin():
    response = client.get("/api/admin/analytics/live")
    assert response.status_code == 401


def test_analytics_live_with_admin():
    token = _make_admin_token()
    response = client.get(
        "/api/admin/analytics/live",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "active_sessions" in data
    assert isinstance(data["active_sessions"], int)


def test_analytics_recent_requires_admin():
    response = client.get("/api/admin/analytics/recent")
    assert response.status_code == 401


def test_analytics_recent_with_admin():
    # Track a couple of events first
    client.post("/api/analytics/event", json={"event_type": "page_view", "path": "/test-recent"})
    client.post("/api/analytics/event", json={"event_type": "search_view", "path": "/test-recent"})

    token = _make_admin_token()
    response = client.get(
        "/api/admin/analytics/recent",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)


def test_analytics_overview_counts_events():
    session_id = f"test-session-{time.time()}"
    # Track several events
    for _ in range(3):
        client.post("/api/analytics/event", json={
            "event_type": "page_view",
            "anonymous_session_id": session_id,
        })
    client.post("/api/analytics/event", json={
        "event_type": "search_view",
        "anonymous_session_id": session_id,
    })

    token = _make_admin_token()
    response = client.get(
        "/api/admin/analytics/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["today"]["total_events"] >= 4
