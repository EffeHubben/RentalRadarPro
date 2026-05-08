"""Regression tests for scraper listing creation/update metadata handling."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace

os.environ.setdefault(
    "DATABASE_URL",
    f"sqlite:///{tempfile.mkdtemp(prefix='rentscout-scraper-metadata-tests-')}/test.db",
)
os.environ.setdefault("JWT_SECRET_KEY", "test-scraper-metadata-secret-at-least-32-bytes")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.scrapers import ScraperRunRequest, run_scrapers
from app.database.db import SessionLocal, create_database_tables
from app.models.listing import Listing
from app.scrapers.base import ScrapedListing


create_database_tables()


def reset_listings() -> None:
    database = SessionLocal()
    try:
        database.query(Listing).delete()
        database.commit()
    finally:
        database.close()


def make_fake_source() -> SimpleNamespace:
    return SimpleNamespace(
        source_key="funda",
        source_id="funda",
        display_name="Funda",
        base_url="https://example.com",
        timeout_seconds=30,
        auto_scan_enabled=True,
        reliability_weight=0.9,
        status="online",
        failure_count=0,
        last_scan_started_at=None,
        last_scan_finished_at=None,
        listings_found_last_scan=0,
        last_success_at=None,
        last_error=None,
        manual_search_url=lambda city: None,
    )


def test_run_scrapers_ignores_source_key_in_metadata(monkeypatch) -> None:
    reset_listings()
    fake_source = make_fake_source()
    calls = {"count": 0}

    first_listing = ScrapedListing(
        title="Appartement Rotterdam",
        source="Funda",
        url="https://example.com/listing-1",
        city="Rotterdam",
        price=1450,
        area_m2=52,
        rooms=2,
        description="Te huur in Rotterdam",
        availability_status="available",
        is_available=True,
    )
    updated_listing = ScrapedListing(
        title="Appartement Rotterdam updated",
        source="Funda",
        url="https://example.com/listing-1",
        city="Rotterdam",
        price=1475,
        area_m2=52,
        rooms=2,
        description="Te huur in Rotterdam",
        availability_status="available",
        is_available=True,
    )

    def fake_fetch_source_with_timeout(source, city):
        calls["count"] += 1
        return [first_listing] if calls["count"] == 1 else [updated_listing]

    monkeypatch.setattr("app.api.scrapers.enabled_sources", lambda *args, **kwargs: [fake_source])
    monkeypatch.setattr("app.api.scrapers.fetch_source_with_timeout", fake_fetch_source_with_timeout)
    monkeypatch.setattr(
        "app.api.scrapers.build_listing_quality",
        lambda *_args, **_kwargs: {
            "source_key": "wrong-metadata-key",
            "confidence_score": 0.82,
            "property_type": "apartment",
        },
    )
    monkeypatch.setattr(
        "app.api.scrapers.build_location_metadata",
        lambda *_args, **_kwargs: {
            "location_precision": "city",
            "location_confidence": 0.4,
        },
    )
    monkeypatch.setattr("app.api.scrapers.add_location_quality_boost", lambda *_args, **_kwargs: None)
    monkeypatch.setattr("app.api.scrapers.assign_duplicate_metadata", lambda *_args, **_kwargs: None)
    monkeypatch.setattr("app.api.scrapers.refresh_duplicate_group", lambda *_args, **_kwargs: None)
    monkeypatch.setattr("app.api.scrapers.reset_geocode_run_budget", lambda: None)
    monkeypatch.setattr("app.api.scrapers.record_scan_history", lambda *_args, **_kwargs: None)

    database = SessionLocal()
    try:
        first_response = run_scrapers(ScraperRunRequest(city="Rotterdam"), database=database)
        assert first_response["created_count"] == 1
        assert first_response["updated_count"] == 0

        listing = database.query(Listing).one()
        assert listing.source_key == "funda"
        assert listing.title == "Appartement Rotterdam"
        assert listing.price == 1450

        second_response = run_scrapers(ScraperRunRequest(city="Rotterdam"), database=database)
        assert second_response["created_count"] == 0
        assert second_response["updated_count"] == 1

        listing = database.query(Listing).one()
        assert listing.source_key == "funda"
        assert listing.title == "Appartement Rotterdam updated"
        assert listing.price == 1475
    finally:
        database.close()
