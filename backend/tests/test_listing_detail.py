import os
import sys
import tempfile
import time
from pathlib import Path

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp(prefix='rentscout-listing-detail-tests-')}/test.db"
os.environ["JWT_SECRET_KEY"] = "test-listing-detail-secret-at-least-32-bytes"
os.environ["REFRESH_COOKIE_SECURE"] = "false"
os.environ["REFRESH_COOKIE_SAMESITE"] = "lax"
os.environ["TURNSTILE_REQUIRED"] = "false"
os.environ["EMAIL_VERIFICATION_ENABLED"] = "false"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.database.db import SessionLocal, create_database_tables
from app.main import app
from app.models.listing import Listing
from app.models.user import User
from app.core.security import create_access_token

create_database_tables()

client = TestClient(app)


def unique_email(prefix: str) -> str:
    return f"{prefix}-{time.time()}@example.com"


def _create_listing(**kwargs) -> int:
    db = SessionLocal()
    try:
        defaults = {
            "title": "Test Apartment",
            "url": f"https://example.com/listing/{time.time()}",
            "source": "test_source",
            "city": "Amsterdam",
            "price": 1200,
            "area_m2": 55,
            "rooms": 2,
            "property_type": "apartment",
            "is_active": True,
            "availability_status": "available",
            "is_available": True,
            "location_precision": "city",
            "location_confidence": 0.5,
            "source_count": 1,
        }
        defaults.update(kwargs)
        listing = Listing(**defaults)
        db.add(listing)
        db.commit()
        db.refresh(listing)
        return listing.id
    finally:
        db.close()


def _make_user_token(plan: str = "free") -> str:
    db = SessionLocal()
    try:
        email = unique_email(f"user-listing-{plan}")
        user = User(
            email=email,
            email_normalized=email.lower(),
            password_hash="test-hash",
            is_admin=False,
            email_verified=True,
            plan=plan,
            subscription_status="active" if plan == "pro" else "inactive",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return create_access_token(user)
    finally:
        db.close()


def test_listing_detail_unauthenticated_returns_preview():
    listing_id = _create_listing(description="Full description here", address_text="Streetlaan 12")
    response = client.get(f"/api/listings/{listing_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == listing_id
    assert data["city"] == "Amsterdam"
    assert data["price"] == 1200
    # Preview fields only — premium fields should be absent or null
    assert "description" not in data or data.get("description") is None
    assert "address_text" not in data or data.get("address_text") is None
    assert "url" not in data or data.get("url") == "#"


def test_listing_detail_free_user_returns_preview():
    listing_id = _create_listing(description="Full description here")
    token = _make_user_token(plan="free")
    response = client.get(
        f"/api/listings/{listing_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == listing_id
    assert "description" not in data or data.get("description") is None


def test_listing_detail_pro_user_returns_full():
    listing_id = _create_listing(description="Pro description content", address_text="Prinsengracht 99")
    token = _make_user_token(plan="pro")
    response = client.get(
        f"/api/listings/{listing_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == listing_id
    assert data["description"] == "Pro description content"
    assert data["url"] != "#"


def test_listing_detail_not_found():
    response = client.get("/api/listings/99999999")
    assert response.status_code == 404


def test_sitemap_endpoint_returns_listing_list():
    _create_listing(city="Rotterdam", property_type="studio")
    response = client.get("/api/listings/sitemap")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if data:
        item = data[0]
        assert "id" in item
        assert "city" in item
        assert "property_type" in item
        assert "updated_at" in item


def test_sitemap_excludes_rented_listings():
    rented_id = _create_listing(
        city="Utrecht",
        availability_status="rented",
        is_available=False,
    )
    response = client.get("/api/listings/sitemap")
    assert response.status_code == 200
    data = response.json()
    ids = [item["id"] for item in data]
    assert rented_id not in ids


def test_listing_preview_fields_only_flag():
    listing_id = _create_listing(city="Den Haag")
    response = client.get(f"/api/listings/{listing_id}")
    assert response.status_code == 200
    data = response.json()
    assert data.get("preview_fields_only") is True or "url" not in data or data.get("url") == "#"
