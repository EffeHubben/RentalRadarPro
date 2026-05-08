from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

os.environ.setdefault(
    "DATABASE_URL",
    f"sqlite:///{tempfile.mkdtemp(prefix='rentscout-location-repair-tests-')}/test.db",
)
os.environ.setdefault("JWT_SECRET_KEY", "test-location-repair-secret-at-least-32-bytes")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.listing import Listing
from app.services.listing_location_repair import plan_listing_location_repair


def make_listing(**overrides: object) -> Listing:
    defaults: dict[str, object] = {
        "id": 1,
        "title": "Woning te huur",
        "source": "funda",
        "url": "https://www.funda.nl/huur/breda/appartement-123",
        "city": "Breda",
        "description": None,
        "address_text": "Breda, Nederland",
        "street_name": None,
        "house_number": None,
        "postal_code": None,
        "latitude": 51.5719,
        "longitude": 4.7683,
        "location_precision": "city",
        "location_confidence": 0.35,
        "property_type": "unknown",
        "is_active": True,
    }
    defaults.update(overrides)
    return Listing(**defaults)


def test_rotterdam_breda_bug_can_be_repaired_from_url_and_title() -> None:
    listing = make_listing(
        title="Appartement in Rotterdam Centrum",
        url="https://www.funda.nl/huur/rotterdam/appartement-123",
    )

    plan = plan_listing_location_repair(listing)

    assert plan.action == "repair_location"
    assert plan.target_city == "Rotterdam"
    assert plan.updates["city"] == "Rotterdam"
    assert plan.updates["latitude"] == 51.9244
    assert plan.updates["longitude"] == 4.4777
    assert plan.updates["address_text"] == "Rotterdam, Nederland"


def test_real_breda_listing_stays_breda() -> None:
    listing = make_listing(
        title="Appartement in Breda Centrum",
        url="https://www.funda.nl/huur/breda/appartement-123",
    )

    plan = plan_listing_location_repair(listing)

    assert plan.action == "noop"
    assert plan.updates == {}


def test_ambiguous_listing_is_not_rewritten_aggressively() -> None:
    listing = make_listing(
        title="Studio nabij Rotterdam centraal",
        url="https://www.example.com/listing/123",
    )

    plan = plan_listing_location_repair(listing)

    assert plan.action == "clear_city_and_coordinates"
    assert plan.updates["city"] is None
    assert plan.updates["latitude"] is None
    assert plan.updates["longitude"] is None
    assert plan.updates["address_text"] is None


def test_unknown_city_never_becomes_breda() -> None:
    listing = make_listing(
        city=None,
        address_text=None,
        latitude=None,
        longitude=None,
        title="Rustige studio zonder plaatsnaam",
        url="https://www.example.com/listing/456",
    )

    plan = plan_listing_location_repair(listing)

    assert plan.action == "noop"
    assert plan.updates == {}


def test_bad_breda_fallback_coordinates_can_be_cleared_without_rewriting_city() -> None:
    listing = make_listing(
        city="Utrecht",
        address_text="Utrecht, Nederland",
        title="Woning te huur",
        url="https://www.example.com/listing/789",
    )

    plan = plan_listing_location_repair(listing)

    assert plan.action == "clear_coordinates"
    assert "city" not in plan.updates
    assert plan.updates["latitude"] is None
    assert plan.updates["longitude"] is None
    assert plan.updates["location_precision"] == "unknown"


def test_precise_address_can_repair_city_without_inventing_exact_coordinates() -> None:
    listing = make_listing(
        city="Breda",
        title="Ruim appartement",
        url="https://www.example.com/listing/101",
        address_text="Coolsingel 12, 3011 AD Rotterdam, Nederland",
        street_name="Coolsingel",
        house_number="12",
        postal_code="3011 AD",
        latitude=51.5719,
        longitude=4.7683,
        location_precision="postcode",
    )

    plan = plan_listing_location_repair(listing)

    assert plan.action == "repair_location"
    assert plan.updates["city"] == "Rotterdam"
    assert plan.updates["latitude"] == 51.9244
    assert plan.updates["longitude"] == 4.4777
    assert plan.updates["location_precision"] == "city"
    assert "address_text" not in plan.updates


def test_no_city_no_coordinates_do_not_gain_breda_fallback() -> None:
    listing = make_listing(
        city=None,
        address_text=None,
        latitude=None,
        longitude=None,
        title="Net appartement",
        url="https://www.example.com/listing/202",
        location_precision="unknown",
    )

    plan = plan_listing_location_repair(listing)

    assert plan.action == "noop"
    assert plan.updates == {}
