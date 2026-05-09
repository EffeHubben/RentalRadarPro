"""Tests for facility/privacy filter logic.

Verifies that:
- Apartments/houses/studios with NULL amenity fields pass private-facility filters.
- Rooms with NULL amenity fields do NOT pass strict private-facility filters.
- Listings explicitly marked shared/private behave correctly.
- Free vs Pro listing gating is unchanged.
- The inference helper assigns correct values based on property type and text.
"""
import os
import sys
import tempfile
import time
from pathlib import Path

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp(prefix='rentscout-privacy-tests-')}/test.db"
os.environ["JWT_SECRET_KEY"] = "test-privacy-filter-secret-at-least-32-bytes"
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
from app.services.listing_quality import (
    infer_private_feature,
    PRIVATE_KITCHEN_KEYWORDS,
    SHARED_KITCHEN_KEYWORDS,
    PRIVATE_BATHROOM_KEYWORDS,
    SHARED_BATHROOM_KEYWORDS,
    PRIVATE_TOILET_KEYWORDS,
    SHARED_TOILET_KEYWORDS,
)

create_database_tables()

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _listing(**kwargs) -> int:
    db = SessionLocal()
    try:
        base = {
            "url": f"https://example.com/{time.time()}",
            "source": "test",
            "is_active": True,
            "availability_status": "available",
            "is_available": True,
            "location_precision": "city",
            "location_confidence": 0.5,
            "source_count": 1,
            "price": 1000,
            "city": "Amsterdam",
        }
        base.update(kwargs)
        lst = Listing(**base)
        db.add(lst)
        db.commit()
        db.refresh(lst)
        return lst.id
    finally:
        db.close()


def _ids(response) -> set:
    return {item["id"] for item in response.json()["items"]}


def _pro_token() -> str:
    db = SessionLocal()
    try:
        email = f"pro-{time.time()}@example.com"
        user = User(
            email=email,
            email_normalized=email.lower(),
            password_hash="hash",
            is_admin=False,
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


def _free_token() -> str:
    db = SessionLocal()
    try:
        email = f"free-{time.time()}@example.com"
        user = User(
            email=email,
            email_normalized=email.lower(),
            password_hash="hash",
            is_admin=False,
            email_verified=True,
            plan="free",
            subscription_status="inactive",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return create_access_token(user)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Unit tests: infer_private_feature
# ---------------------------------------------------------------------------

def test_infer_kitchen_unknown_apartment_returns_true():
    result = infer_private_feature(
        "appartement te huur in amsterdam 2 kamers",
        PRIVATE_KITCHEN_KEYWORDS,
        SHARED_KITCHEN_KEYWORDS,
        property_type="apartment",
    )
    assert result is True


def test_infer_kitchen_unknown_house_returns_true():
    result = infer_private_feature(
        "woning te huur rustige straat",
        PRIVATE_KITCHEN_KEYWORDS,
        SHARED_KITCHEN_KEYWORDS,
        property_type="house",
    )
    assert result is True


def test_infer_kitchen_unknown_studio_returns_true():
    result = infer_private_feature(
        "studio available from july",
        PRIVATE_KITCHEN_KEYWORDS,
        SHARED_KITCHEN_KEYWORDS,
        property_type="studio",
    )
    assert result is True


def test_infer_kitchen_unknown_room_returns_none():
    result = infer_private_feature(
        "kamer te huur in gedeeld huis",
        PRIVATE_KITCHEN_KEYWORDS,
        SHARED_KITCHEN_KEYWORDS,
        property_type="room",
    )
    assert result is None


def test_infer_kitchen_shared_signal_apartment_returns_false():
    result = infer_private_feature(
        "appartement met gedeelde keuken en huisgenoten",
        PRIVATE_KITCHEN_KEYWORDS,
        SHARED_KITCHEN_KEYWORDS,
        property_type="apartment",
    )
    assert result is False


def test_infer_bathroom_shared_text_overrides_type():
    result = infer_private_feature(
        "studio met gedeelde badkamer",
        PRIVATE_BATHROOM_KEYWORDS,
        SHARED_BATHROOM_KEYWORDS,
        property_type="studio",
    )
    assert result is False


def test_infer_toilet_explicit_private():
    result = infer_private_feature(
        "kamer met eigen toilet en douche",
        PRIVATE_TOILET_KEYWORDS,
        SHARED_TOILET_KEYWORDS,
        property_type="room",
    )
    assert result is True


def test_infer_apartment_with_shared_signals_does_not_get_true():
    result = infer_private_feature(
        "appartement studentenhuis huisgenoten gezocht",
        PRIVATE_KITCHEN_KEYWORDS,
        SHARED_KITCHEN_KEYWORDS,
        property_type="apartment",
    )
    # shared signals prevent the type-based assumption
    assert result is None or result is False


# ---------------------------------------------------------------------------
# Integration tests: API filter behaviour
# ---------------------------------------------------------------------------

def test_apartment_null_facilities_passes_private_kitchen_filter():
    listing_id = _listing(
        title="Apartment no amenity data",
        property_type="apartment",
        private_kitchen=None,
        private_bathroom=None,
        private_toilet=None,
        is_shared=None,
    )
    resp = client.get("/api/listings/", params={"private_kitchen": "true"})
    assert resp.status_code == 200
    assert listing_id in _ids(resp)


def test_house_null_facilities_passes_private_bathroom_filter():
    listing_id = _listing(
        title="House no amenity data",
        property_type="house",
        private_kitchen=None,
        private_bathroom=None,
        private_toilet=None,
        is_shared=None,
    )
    resp = client.get("/api/listings/", params={"private_bathroom": "true"})
    assert resp.status_code == 200
    assert listing_id in _ids(resp)


def test_studio_null_facilities_passes_private_toilet_filter():
    listing_id = _listing(
        title="Studio no amenity data",
        property_type="studio",
        private_kitchen=None,
        private_bathroom=None,
        private_toilet=None,
        is_shared=None,
    )
    resp = client.get("/api/listings/", params={"private_toilet": "true"})
    assert resp.status_code == 200
    assert listing_id in _ids(resp)


def test_room_null_facilities_excluded_by_private_kitchen_filter():
    listing_id = _listing(
        title="Room in shared house no amenity data",
        property_type="room",
        private_kitchen=None,
        private_bathroom=None,
        private_toilet=None,
        is_shared=None,
    )
    resp = client.get("/api/listings/", params={"private_kitchen": "true"})
    assert resp.status_code == 200
    assert listing_id not in _ids(resp)


def test_room_explicit_private_bathroom_passes_filter():
    listing_id = _listing(
        title="Room with private bathroom",
        property_type="room",
        private_kitchen=None,
        private_bathroom=True,
        private_toilet=None,
        is_shared=None,
    )
    resp = client.get("/api/listings/", params={"private_bathroom": "true"})
    assert resp.status_code == 200
    assert listing_id in _ids(resp)


def test_apartment_explicit_shared_bathroom_excluded_by_filter():
    listing_id = _listing(
        title="Apartment shared bathroom",
        property_type="apartment",
        private_bathroom=False,
        is_shared=True,
    )
    resp = client.get("/api/listings/", params={"private_bathroom": "true"})
    assert resp.status_code == 200
    assert listing_id not in _ids(resp)


def test_apartment_is_shared_true_excluded_by_private_kitchen_filter():
    listing_id = _listing(
        title="Apartment flagged as shared",
        property_type="apartment",
        private_kitchen=None,
        is_shared=True,
    )
    resp = client.get("/api/listings/", params={"private_kitchen": "true"})
    assert resp.status_code == 200
    assert listing_id not in _ids(resp)


def test_normal_apartment_no_amenity_data_not_wrongly_excluded():
    listing_id = _listing(
        title="Mooie 2-kamer appartement te huur",
        property_type="apartment",
        private_kitchen=None,
        private_bathroom=None,
        private_toilet=None,
        is_shared=None,
    )
    resp = client.get(
        "/api/listings/",
        params={
            "private_kitchen": "true",
            "private_bathroom": "true",
            "private_toilet": "true",
        },
    )
    assert resp.status_code == 200
    assert listing_id in _ids(resp), "Apartment with unknown amenities must not be wrongly excluded"


def test_shared_housing_disabled_excludes_shared_room():
    listing_id = _listing(
        title="Kamer in gedeelde woning",
        property_type="room",
        is_shared=True,
    )
    resp = client.get("/api/listings/", params={"allow_shared": "false"})
    assert resp.status_code == 200
    assert listing_id not in _ids(resp)


def test_shared_housing_disabled_keeps_normal_apartment():
    listing_id = _listing(
        title="Appartement zelfstandig",
        property_type="apartment",
        is_shared=False,
    )
    resp = client.get("/api/listings/", params={"allow_shared": "false"})
    assert resp.status_code == 200
    assert listing_id in _ids(resp)


# ---------------------------------------------------------------------------
# Free vs Pro gating unchanged
# ---------------------------------------------------------------------------

def test_free_user_does_not_see_premium_fields():
    _listing(
        title="Appartement gratis preview",
        property_type="apartment",
        private_kitchen=True,
        private_bathroom=True,
        description="Mooie woning met eigen badkamer",
    )
    token = _free_token()
    resp = client.get(
        "/api/listings/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    for item in items:
        assert item.get("description") is None
        assert item.get("address_text") is None


def test_pro_user_sees_full_listing_details():
    listing_id = _listing(
        title="Appartement Pro volledig",
        property_type="apartment",
        private_kitchen=True,
        description="Eigen keuken en badkamer aanwezig",
    )
    token = _pro_token()
    resp = client.get(
        f"/api/listings/{listing_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == listing_id
    assert data.get("description") is not None
