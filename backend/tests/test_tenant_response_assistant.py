import os
import sys
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp(prefix='rentscout-tenant-assistant-tests-')}/test.db"
os.environ["JWT_SECRET_KEY"] = "test-tenant-assistant-secret-at-least-32-bytes"
os.environ["REFRESH_COOKIE_SECURE"] = "false"
os.environ["REFRESH_COOKIE_SAMESITE"] = "lax"
os.environ["TURNSTILE_REQUIRED"] = "false"
os.environ["EMAIL_VERIFICATION_ENABLED"] = "false"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.database.db import SessionLocal, create_database_tables
from app.main import app
from app.models.listing import Listing
from app.models.tenant import TenantProfile
from app.models.user import User
from app.services.tenant_response_generator import calculate_profile_completion, generate_tenant_response


create_database_tables()
client = TestClient(app)


def unique_email(prefix: str) -> str:
    return f"{prefix}-{time.time_ns()}@example.com"


def create_user(*, pro: bool = False, pro_expires: bool = False) -> User:
    email = unique_email("tenant")
    database = SessionLocal()
    try:
        user = User(
            email=email,
            email_normalized=email,
            password_hash="hash",
            is_admin=False,
            email_verified=True,
            plan="pro" if pro else "free",
            subscription_status="active" if pro else "inactive",
            pro_expires_at=datetime.utcnow() + timedelta(days=7) if pro_expires else None,
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


def create_listing(**kwargs) -> int:
    database = SessionLocal()
    try:
        data = {
            "title": "Licht appartement aan het park",
            "url": f"https://example.com/listing/{time.time_ns()}",
            "source": "Test Makelaar",
            "source_key": "test_makelaar",
            "city": "Breda",
            "price": 1250,
            "area_m2": 62,
            "rooms": 2,
            "property_type": "apartment",
            "availability_status": "available",
            "is_available": True,
            "is_active": True,
            "location_precision": "city",
            "location_confidence": 0.6,
            "source_count": 1,
        }
        data.update(kwargs)
        listing = Listing(**data)
        database.add(listing)
        database.commit()
        database.refresh(listing)
        return listing.id
    finally:
        database.close()


def create_profile(user_id: int, **kwargs) -> TenantProfile:
    database = SessionLocal()
    try:
        data = {
            "user_id": user_id,
            "full_name": "Sam Jansen",
            "occupation_or_study": "softwareontwikkelaar",
            "monthly_income_range": "EUR 3.000 - 3.500 bruto per maand",
            "household_size": 1,
            "pets": False,
            "smoker": False,
            "short_intro": "Ik ben rustig, netjes en zoek een fijne plek voor langere tijd.",
            "strengths_as_tenant": "Ik ga zorgvuldig om met mijn woning en buren.",
            "income_proof_ready": True,
            "id_ready": True,
        }
        data.update(kwargs)
        profile = TenantProfile(**data)
        database.add(profile)
        database.commit()
        database.refresh(profile)
        database.expunge(profile)
        return profile
    finally:
        database.close()


def test_create_and_update_tenant_profile() -> None:
    user = create_user()

    empty = client.get("/api/account/tenant-profile", headers=auth_headers(user))
    assert empty.status_code == 200
    assert empty.json()["completion_percentage"] == 0

    response = client.put(
        "/api/account/tenant-profile",
        headers=auth_headers(user),
        json={
            "full_name": "  Sam Jansen  ",
            "age": 31,
            "preferred_city": "Breda",
            "household_size": 1,
            "pets": False,
            "smoker": False,
            "id_ready": True,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Sam Jansen"
    assert data["completion_percentage"] > 0


def test_profile_completion_calculation() -> None:
    profile = TenantProfile(
        user_id=1,
        full_name="Sam",
        occupation_or_study="docent",
        household_size=1,
        pets=False,
        id_ready=True,
    )
    completion = calculate_profile_completion(profile)
    assert 20 <= completion <= 35


def test_generator_professional_short_and_warm_styles() -> None:
    listing = Listing(
        title="Appartement centrum",
        source="test",
        url="https://example.com/a",
        city="Utrecht",
        price=1100,
        property_type="apartment",
        availability_status="available",
    )
    profile = TenantProfile(
        user_id=1,
        full_name="Sam Jansen",
        occupation_or_study="docent",
        monthly_income_range="EUR 3.000 - 3.500",
        household_size=1,
        pets=False,
        smoker=False,
        income_proof_ready=True,
    )

    professional = generate_tenant_response(profile, listing, "professional")
    short = generate_tenant_response(profile, listing, "short")
    warm = generate_tenant_response(profile, listing, "warm")

    assert "Beste verhuurder" in professional.message
    assert "Graag kom ik in aanmerking" in professional.message
    assert "Graag hoor ik" in short.message
    assert "met plezier" in warm.message
    assert professional.style == "professional"
    assert short.style == "short"
    assert warm.style == "warm"


def test_generator_does_not_invent_missing_income_job_or_documents() -> None:
    listing = Listing(
        title="Studio",
        source="test",
        url="https://example.com/studio",
        city="Tilburg",
        property_type="studio",
    )
    profile = TenantProfile(
        user_id=1,
        full_name=None,
        household_size=1,
        pets=False,
        smoker=False,
        income_proof_ready=False,
        employer_statement_ready=False,
        bank_statement_ready=False,
    )

    generated = generate_tenant_response(profile, listing, "professional")

    assert "[naam]" in generated.message
    assert "inkomensindicatie" not in generated.message
    assert "inkomensbewijs" not in generated.message
    assert "werkgeversverklaring" not in generated.message
    assert "bankafschrift" not in generated.message
    assert "Ik ben softwareontwikkelaar" not in generated.message
    assert "monthly_income_range" in generated.missing_fields
    assert "occupation_or_study" in generated.missing_fields


def test_free_user_cannot_generate_listing_specific_response() -> None:
    user = create_user(pro=False)
    listing_id = create_listing()

    response = client.post(
        f"/api/listings/{listing_id}/generate-response",
        headers=auth_headers(user),
        json={"style": "professional"},
    )

    assert response.status_code == 403
    assert "Pro" in response.json()["detail"]


def test_pro_user_via_pro_expires_at_can_generate_response() -> None:
    user = create_user(pro=False, pro_expires=True)
    create_profile(user.id)
    listing_id = create_listing()

    response = client.post(
        f"/api/listings/{listing_id}/generate-response",
        headers=auth_headers(user),
        json={"style": "warm"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["style"] == "warm"
    assert "Sam Jansen" in data["message"]
    assert "Breda" in data["message"]


def test_saved_response_per_listing_works() -> None:
    user = create_user(pro=True)
    listing_id = create_listing()

    save_response = client.post(
        f"/api/listings/{listing_id}/saved-response",
        headers=auth_headers(user),
        json={"style": "professional", "generated_message": "Beste verhuurder..."},
    )
    assert save_response.status_code == 200

    get_response = client.get(
        f"/api/listings/{listing_id}/saved-response",
        headers=auth_headers(user),
    )
    assert get_response.status_code == 200
    assert get_response.json()["generated_message"] == "Beste verhuurder..."


def test_listing_gating_still_returns_preview_for_free_user() -> None:
    user = create_user(pro=False)
    listing_id = create_listing(description="Premium details", address_text="Parkstraat 10")

    response = client.get(f"/api/listings/{listing_id}", headers=auth_headers(user))

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == listing_id
    assert "description" not in data or data.get("description") is None
    assert "address_text" not in data or data.get("address_text") is None
