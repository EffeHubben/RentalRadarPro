"""Tests for nationwide search and multi-city scanner coverage."""

from __future__ import annotations

import os
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

os.environ.setdefault(
    "DATABASE_URL",
    f"sqlite:///{tempfile.mkdtemp(prefix='rentscout-nationwide-tests-')}/test.db",
)
os.environ.setdefault("JWT_SECRET_KEY", "test-nationwide-secret-at-least-32-bytes")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.api.scrapers import normalize_city as scanner_normalize_city
from app.core.config import settings
from app.database.db import SessionLocal, create_database_tables
from app.main import app
from app.models.listing import Listing
from app.models.scan_history import ScanHistory
from app.scrapers.funda import build_funda_search_url
from app.scrapers.ikwilhuren import build_ikwilhuren_search_url
from app.scrapers.marktplaats import build_search_urls as build_marktplaats_search_urls
from app.services.scanner import due_sources_for_city
from app.services.scanner_schedule import scan_decision_for_source
from app.sources.registry import RENTAL_SOURCES


create_database_tables()
client = TestClient(app)


def reset_tables() -> None:
    database = SessionLocal()
    try:
        database.query(Listing).delete()
        database.query(ScanHistory).delete()
        database.commit()
    finally:
        database.close()


def test_settings_scan_cities_parses_default_list() -> None:
    cities = settings.scan_cities

    assert "Rotterdam" in cities
    assert "Amsterdam" in cities
    assert "Breda" in cities
    assert len(cities) >= 10


def test_settings_scan_cities_falls_back_to_default_city_when_blank(monkeypatch) -> None:
    monkeypatch.setattr(settings, "listing_scan_cities", "  ")
    cities = settings.scan_cities

    assert cities == [settings.default_city]


def test_listings_api_returns_all_cities_when_no_city_filter() -> None:
    reset_tables()
    database = SessionLocal()
    try:
        database.add_all(
            [
                Listing(
                    title="Breda one",
                    source="Funda",
                    url="https://example.com/breda-1",
                    city="Breda",
                    is_active=True,
                ),
                Listing(
                    title="Rotterdam one",
                    source="Funda",
                    url="https://example.com/rotterdam-1",
                    city="Rotterdam",
                    is_active=True,
                ),
                Listing(
                    title="Amsterdam one",
                    source="Funda",
                    url="https://example.com/amsterdam-1",
                    city="Amsterdam",
                    is_active=True,
                ),
            ]
        )
        database.commit()
    finally:
        database.close()

    response = client.get("/api/listings/")
    assert response.status_code == 200
    payload = response.json()

    assert payload["total"] == 3
    cities = {item["city"] for item in payload["items"]}
    assert cities == {"Amsterdam", "Breda", "Rotterdam"}


def test_funda_url_uses_requested_city() -> None:
    breda = build_funda_search_url("Breda")
    rotterdam = build_funda_search_url("Rotterdam")
    amsterdam = build_funda_search_url("Amsterdam")

    assert "%22breda%22" in breda
    assert "%22rotterdam%22" in rotterdam
    assert "%22amsterdam%22" in amsterdam
    assert breda != rotterdam != amsterdam


def test_marktplaats_search_urls_use_requested_city() -> None:
    urls = build_marktplaats_search_urls("Rotterdam")

    assert urls
    for url in urls:
        assert "rotterdam" in url.lower()


def test_ikwilhuren_url_uses_requested_city() -> None:
    rotterdam = build_ikwilhuren_search_url("Rotterdam")
    breda = build_ikwilhuren_search_url("Breda")

    assert "rotterdam" in rotterdam.lower()
    assert "breda" in breda.lower()
    assert rotterdam != breda


def test_scanner_normalize_city_falls_back_to_default_when_empty() -> None:
    assert scanner_normalize_city("") == settings.default_city
    assert scanner_normalize_city(None) == settings.default_city
    assert scanner_normalize_city("Rotterdam") == "Rotterdam"


def test_due_sources_for_city_treats_unscanned_city_as_due() -> None:
    reset_tables()
    database = SessionLocal()
    try:
        due_for_rotterdam = due_sources_for_city(database, "Rotterdam")
    finally:
        database.close()

    assert "funda" in due_for_rotterdam
    assert "marktplaats" in due_for_rotterdam


def test_due_sources_for_city_skips_recently_scanned_city() -> None:
    reset_tables()
    now = datetime.utcnow()

    database = SessionLocal()
    try:
        database.add(
            ScanHistory(
                city="Rotterdam",
                source_id="funda",
                status="success",
                scraped_count=5,
                created_count=2,
                updated_count=3,
                started_at=now - timedelta(seconds=10),
                finished_at=now,
            )
        )
        database.commit()
    finally:
        database.close()

    database = SessionLocal()
    try:
        due_for_rotterdam = due_sources_for_city(database, "Rotterdam")
    finally:
        database.close()

    # funda should have just been scanned, but other sources should still be due.
    assert "funda" not in due_for_rotterdam
    assert "marktplaats" in due_for_rotterdam


def source_by_key(source_key: str):
    return next(source for source in RENTAL_SOURCES if source.source_key == source_key)


def test_due_sources_for_city_never_selects_manual_sources() -> None:
    reset_tables()
    database = SessionLocal()
    try:
        due_for_breda = due_sources_for_city(database, "Breda")
    finally:
        database.close()

    manual_keys = {source.source_key for source in RENTAL_SOURCES if source.source_type == "manual"}
    assert manual_keys.isdisjoint(due_for_breda)


def test_limited_sources_are_not_due_unless_auto_enabled() -> None:
    reset_tables()
    database = SessionLocal()
    try:
        pararius = source_by_key("pararius")
        decision = scan_decision_for_source(database, "Breda", pararius)
    finally:
        database.close()

    assert decision.due is False
    assert decision.reason == "generic_html_not_auto_scanned"


def test_failed_sources_get_cooldown_backoff() -> None:
    reset_tables()
    now = datetime.utcnow()
    database = SessionLocal()
    try:
        database.add(
            ScanHistory(
                city="Breda",
                source_id="funda",
                status="failed",
                scraped_count=0,
                created_count=0,
                updated_count=0,
                started_at=now - timedelta(minutes=1),
                finished_at=now - timedelta(minutes=1),
                error="timeout",
            )
        )
        database.commit()
        decision = scan_decision_for_source(database, "Breda", source_by_key("funda"), now=now)
    finally:
        database.close()

    assert decision.due is False
    assert decision.reason == "failure_backoff:1"


def test_repeated_zero_sources_get_backoff() -> None:
    reset_tables()
    now = datetime.utcnow()
    database = SessionLocal()
    try:
        for index in range(3):
            database.add(
                ScanHistory(
                    city="Breda",
                    source_id="funda",
                    status="no_results",
                    scraped_count=0,
                    created_count=0,
                    updated_count=0,
                    started_at=now - timedelta(minutes=4 + index),
                    finished_at=now - timedelta(minutes=4 + index),
                )
            )
        database.commit()
        decision = scan_decision_for_source(database, "Breda", source_by_key("funda"), now=now)
    finally:
        database.close()

    assert decision.due is False
    assert decision.reason == "zero_result_backoff:3"


def test_admin_coverage_endpoint_requires_admin() -> None:
    response = client.get("/api/admin/coverage")
    assert response.status_code in (401, 403)


def test_listings_api_keeps_backwards_compat_for_single_city() -> None:
    reset_tables()
    database = SessionLocal()
    try:
        database.add_all(
            [
                Listing(
                    title="Rotterdam",
                    source="Funda",
                    url="https://example.com/rotterdam",
                    city="Rotterdam",
                    is_active=True,
                ),
                Listing(
                    title="Breda",
                    source="Funda",
                    url="https://example.com/breda",
                    city="Breda",
                    is_active=True,
                ),
            ]
        )
        database.commit()
    finally:
        database.close()

    response = client.get("/api/listings/?city=Rotterdam")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["city"] == "Rotterdam"


def test_sanitize_keeps_listings_without_image_or_price() -> None:
    from app.scrapers.base import ScrapedListing
    from app.services.scanner_reliability import sanitize_scraped_listing

    listing, reason = sanitize_scraped_listing(
        ScrapedListing(
            title="Cosy studio close to Leidseplein",
            source="Funda",
            url="https://example.com/listing/leidse-1",
            description="",
            price=None,
            area_m2=None,
            image_url=None,
        ),
        fallback_source="Funda",
        requested_city="Amsterdam",
    )

    assert reason is None
    assert listing is not None
    assert listing.price is None
    assert listing.area_m2 is None
    assert listing.image_url is None
