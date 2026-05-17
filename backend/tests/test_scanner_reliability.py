import os
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp(prefix='rentscout-scanner-tests-')}/test.db"
os.environ["JWT_SECRET_KEY"] = "test-scanner-secret-at-least-32-bytes"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.scrapers import ScraperRunRequest, run_scrapers
from app.api.sources import build_sources_payloads
from app.database.db import SessionLocal, create_database_tables
from app.models.listing import Listing
from app.models.scan_history import ScanHistory
from app.scrapers.base import ScrapedListing
from app.scrapers.generic_sources import SourceBlockedError
import app.scrapers.funda as funda_scraper
import app.scrapers.ikwilhuren as ikwilhuren_scraper
from app.services.scanner_reliability import sanitize_scraped_listing, source_listing_signature
from app.services.scanner_reliability import normalize_listing_url


create_database_tables()


def reset_tables() -> None:
    database = SessionLocal()
    try:
        database.query(ScanHistory).delete()
        database.query(Listing).delete()
        database.commit()
    finally:
        database.close()


def test_sanitize_scraped_listing_normalizes_url_and_quality_fields() -> None:
    listing, reason = sanitize_scraped_listing(
        ScrapedListing(
            title="  Compact studio in Breda  ",
            source="",
            url="HTTPS://Example.com/listing/123/?utm_source=test#top",
            city="  ",
            price=120000,
            area_m2=4,
            rooms=25,
            image_url="https://example.com/image.jpg?cache=1",
            description="  Nice place near station.  ",
            address_text="  Markendaalseweg 10  ",
            street_name=" Markendaalseweg ",
            house_number=" 10 ",
            postal_code=" 4811KA ",
        ),
        fallback_source="Example Source",
        requested_city="Breda",
    )

    assert reason is None
    assert listing is not None
    assert listing.source == "Example Source"
    assert listing.url == "https://example.com/listing/123"
    assert listing.city == "Breda"
    assert listing.price is None
    assert listing.area_m2 is None
    assert listing.rooms is None
    assert listing.image_url == "https://example.com/image.jpg?cache=1"
    assert listing.address_text == "Markendaalseweg 10"
    assert listing.street_name == "Markendaalseweg"
    assert listing.house_number == "10"
    assert listing.postal_code == "4811KA"


def test_sanitize_scraped_listing_rejects_invalid_entries() -> None:
    listing, reason = sanitize_scraped_listing(
        ScrapedListing(
            title="Hi",
            source="Broken Source",
            url="javascript:void(0)",
            description="",
        ),
        fallback_source="Broken Source",
        requested_city="Breda",
    )

    assert listing is None
    assert reason == "invalid_url"


def test_build_sources_payloads_includes_failure_history_and_inventory() -> None:
    reset_tables()
    database = SessionLocal()
    now = datetime.utcnow()

    try:
        database.add_all(
            [
                Listing(
                    title="Listing one",
                    source="Funda",
                    source_key="funda",
                    url="https://www.funda.nl/huur/breda/appartement-1",
                    city="Breda",
                    price=1400,
                    is_active=True,
                ),
                Listing(
                    title="Listing two",
                    source="Funda",
                    source_key="funda",
                    url="https://www.funda.nl/huur/breda/appartement-2",
                    city="Breda",
                    price=1600,
                    is_active=False,
                ),
                ScanHistory(
                    city="Breda",
                    source_id="funda",
                    status="failed",
                    scraped_count=0,
                    created_count=0,
                    updated_count=0,
                    skipped_count=0,
                    duplicate_count=0,
                    duration_ms=4500,
                    error="Timeout while waiting for Funda response " + ("x" * 300),
                    started_at=now - timedelta(minutes=31),
                    finished_at=now - timedelta(minutes=30),
                ),
                ScanHistory(
                    city="Breda",
                    source_id="funda",
                    status="success",
                    scraped_count=12,
                    created_count=3,
                    updated_count=4,
                    skipped_count=2,
                    duplicate_count=3,
                    duration_ms=1800,
                    error=None,
                    started_at=now - timedelta(minutes=6),
                    finished_at=now - timedelta(minutes=5),
                ),
            ]
        )
        database.commit()

        payload = next(
            source
            for source in build_sources_payloads(database, city="Breda")
            if source["source_id"] == "funda"
        )
    finally:
        database.close()

    assert payload["status"] == "online"
    assert payload["last_success_at"] is not None
    assert payload["last_failed_at"] is not None
    assert payload["last_failed_error"].startswith("Timeout while waiting for Funda response")
    assert len(payload["last_failed_error"]) <= 240
    assert payload["total_listing_count"] == 2
    assert payload["active_listing_count"] == 1
    assert payload["listings_found_last_scan"] == 12
    assert payload["last_run"]["source"] == "Funda"
    assert payload["last_run"]["duration_ms"] == 1800


def test_source_listing_signature_is_source_scoped() -> None:
    listing = ScrapedListing(
        title="Apartment near centre",
        source="Funda",
        url="https://example.com/listing/1",
        city="Breda",
        price=1450,
        area_m2=55,
        rooms=2,
        address_text="Markendaalseweg 10",
    )

    assert source_listing_signature(listing, "funda", "Breda") == (
        "funda|apartment near centre|breda|markendaalseweg 10|1450|55|2"
    )


def test_normalize_listing_url_keeps_meaningful_query_and_strips_tracking() -> None:
    assert normalize_listing_url(
        "https://www.klikvoorwonen.nl/aanbod/nu-te-huur/huurwoningen/details?"
        "dwellingID=abc123&utm_source=test&fbclid=ignore"
    ) == "https://www.klikvoorwonen.nl/aanbod/nu-te-huur/huurwoningen/details?dwellingID=abc123"


def test_direct_scrapers_raise_blocked_when_browser_fetch_returns_no_html() -> None:
    original_funda_fetch = funda_scraper.fetch_page_with_browser
    original_ikwilhuren_fetch = ikwilhuren_scraper.fetch_page_with_browser

    try:
        funda_scraper.fetch_page_with_browser = lambda *args, **kwargs: None
        ikwilhuren_scraper.fetch_page_with_browser = lambda *args, **kwargs: None

        try:
            funda_scraper.fetch_funda_listings("Breda")
            assert False, "Expected Funda scraper to raise SourceBlockedError"
        except SourceBlockedError:
            pass

        try:
            ikwilhuren_scraper.fetch_ikwilhuren_listings("Breda")
            assert False, "Expected Ik wil huren scraper to raise SourceBlockedError"
        except SourceBlockedError:
            pass
    finally:
        funda_scraper.fetch_page_with_browser = original_funda_fetch
        ikwilhuren_scraper.fetch_page_with_browser = original_ikwilhuren_fetch


def test_manual_external_sources_are_not_scraped_or_recorded() -> None:
    reset_tables()
    database = SessionLocal()
    try:
        result = run_scrapers(ScraperRunRequest(city="Breda", sources=["marktplaats"]), database)
        marktplaats_scans = (
            database.query(ScanHistory)
            .filter(ScanHistory.source_id == "marktplaats")
            .count()
        )
    finally:
        database.close()

    assert result["sources"][0]["status"] == "manual_external"
    assert result["sources"][0]["scraped_count"] == 0
    assert marktplaats_scans == 0


def test_manual_external_sources_ignore_old_scan_history_in_payload() -> None:
    reset_tables()
    database = SessionLocal()
    now = datetime.utcnow()
    try:
        database.add(
            ScanHistory(
                city="Breda",
                source_id="marktplaats",
                status="success",
                scraped_count=120,
                created_count=46,
                updated_count=74,
                started_at=now - timedelta(minutes=10),
                finished_at=now - timedelta(minutes=9),
            )
        )
        database.commit()
        payload = next(
            source
            for source in build_sources_payloads(database, city="Breda")
            if source["source_id"] == "marktplaats"
        )
    finally:
        database.close()

    assert payload["status"] == "manual"
    assert payload["scan_skip_reason"] == "manual_external"
    assert not payload.get("last_run") or payload["last_run"]["status"] == "manual_external"
    assert payload.get("last_success_at") is None
