import os
import sys
import tempfile
from pathlib import Path

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp(prefix='rentscout-source-tests-')}/test.db"
os.environ["JWT_SECRET_KEY"] = "test-source-secret-at-least-32-bytes"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.scrapers import ScraperRunRequest, run_scrapers
import app.api.scrapers as scraper_api
import app.services.scanner as scanner_service
from app.database.db import SessionLocal, create_database_tables
from app.models.listing import Listing
from app.models.scan_history import ScanHistory
from app.models.source import Source, SourceStatus, SourceType
from app.services.scanner_schedule import due_sources_for_city
from app.services.source_catalog import import_seed_sources, sync_registry_sources
from sqlalchemy.exc import IntegrityError


create_database_tables()


def reset_tables() -> None:
    database = SessionLocal()
    try:
        database.query(ScanHistory).delete()
        database.query(Listing).delete()
        database.query(Source).delete()
        database.commit()
        sync_registry_sources(database)
    finally:
        database.close()


def test_source_model_creation() -> None:
    reset_tables()
    database = SessionLocal()
    try:
        source = Source(
            name="Example Manual Source",
            slug="example-manual-source",
            base_url="https://example.com",
            country="NL",
            source_type=SourceType.MANUAL_EXTERNAL.value,
            status=SourceStatus.MANUAL_ONLY.value,
            is_enabled=True,
            scrape_priority=10,
            requires_login=True,
            has_anti_bot=True,
            robots_policy="allowed",
            scan_interval_minutes=1440,
            notes="Manual follow-up only.",
        )
        database.add(source)
        database.commit()
        database.refresh(source)

        assert source.id is not None
        assert source.slug == "example-manual-source"
        assert source.source_type == "manual_external"
        assert source.status == "manual_only"
    finally:
        database.close()


def test_source_import_is_idempotent_by_slug_or_base_url() -> None:
    reset_tables()
    seed = {
        "include_registry_sources": False,
        "sources": [
            {
                "name": "Example Feed",
                "slug": "example-feed",
                "base_url": "https://feeds.example.com/rentals",
                "source_type": "feed",
                "status": "active",
                "is_enabled": True,
                "scan_interval_minutes": 60,
            },
            {
                "name": "Example Feed Renamed",
                "base_url": "https://feeds.example.com/rentals",
                "source_type": "feed",
                "status": "paused",
                "is_enabled": False,
                "scan_interval_minutes": 120,
            },
        ],
    }

    database = SessionLocal()
    try:
        first = import_seed_sources(database, seed)
        second = import_seed_sources(database, seed)
        rows = database.query(Source).filter(Source.base_url == "https://feeds.example.com/rentals").all()

        assert first["created"] == 1
        assert second["created"] == 0
        assert len(rows) == 1
        assert rows[0].name == "Example Feed Renamed"
        assert rows[0].status == "paused"
    finally:
        database.close()


def test_scanner_skips_manual_blocked_and_includes_active_sources(monkeypatch) -> None:
    reset_tables()
    database = SessionLocal()
    try:
        marktplaats = database.query(Source).filter(Source.slug == "marktplaats").one()
        assert marktplaats.source_type == SourceType.MANUAL_EXTERNAL.value
        assert marktplaats.status == SourceStatus.MANUAL_ONLY.value

        blocked_funda = database.query(Source).filter(Source.slug == "funda").one()
        blocked_funda.status = SourceStatus.BLOCKED.value
        database.commit()

        called = {"value": False}

        def fail_if_called(source, city):
            called["value"] = True
            return []

        monkeypatch.setattr(scraper_api, "fetch_source_with_timeout", fail_if_called)
        result = run_scrapers(ScraperRunRequest(city="Breda", sources=["marktplaats", "funda"]), database)
        statuses = {source["source_id"]: source["status"] for source in result["sources"]}

        assert statuses["marktplaats"] == "manual_external"
        assert statuses["funda"] == "skipped"
        assert called["value"] is False
        assert database.query(ScanHistory).count() == 0

        active_funda = database.query(Source).filter(Source.slug == "funda").one()
        active_funda.status = SourceStatus.ACTIVE.value
        active_funda.source_type = SourceType.SCRAPER_ACTIVE.value
        active_funda.is_enabled = True
        database.commit()

        monkeypatch.setattr(scraper_api, "fetch_source_with_timeout", lambda source, city: ([], {}))
        result = run_scrapers(ScraperRunRequest(city="Breda", sources=["funda"]), database)

        assert result["sources"][0]["source_id"] == "funda"
        assert result["sources"][0]["status"] == "source_returned_empty"
        assert database.query(ScanHistory).filter(ScanHistory.source_id == "funda").count() == 1
    finally:
        database.close()


def test_due_sources_uses_persistent_source_catalog() -> None:
    reset_tables()
    database = SessionLocal()
    try:
        funda = database.query(Source).filter(Source.slug == "funda").one()
        marktplaats = database.query(Source).filter(Source.slug == "marktplaats").one()
        assert funda.status == SourceStatus.ACTIVE.value
        assert marktplaats.status == SourceStatus.MANUAL_ONLY.value

        due = due_sources_for_city(database, "Breda")

        assert "funda" in due
        assert "marktplaats" not in due
    finally:
        database.close()


def test_scanner_run_once_empty_sources_scans_nothing(monkeypatch) -> None:
    captured_sources = []

    def fake_run_scrapers(request, database):
        captured_sources.append(request.sources)
        return {"status": "completed", "city": request.city, "sources": []}

    monkeypatch.setattr(scanner_service, "run_scrapers", fake_run_scrapers)

    result = scanner_service.run_once("Breda", [], dry_run=False)

    assert result["status"] == "completed"
    assert captured_sources == [[]]


def test_scanner_run_due_no_due_sources_does_not_fallback_to_automatic(monkeypatch) -> None:
    captured_sources = []

    monkeypatch.setattr(scanner_service, "due_sources_for_city", lambda database, city: [])
    monkeypatch.setattr(scanner_service, "automatic_source_keys", lambda: ["funda"])

    def fake_run_scrapers(request, database):
        captured_sources.append(request.sources)
        return {"status": "completed", "city": request.city, "sources": []}

    monkeypatch.setattr(scanner_service, "run_scrapers", fake_run_scrapers)

    result = scanner_service.run_due("Breda", dry_run=False)

    assert result["status"] == "completed"
    assert captured_sources == [[]]


def test_sync_registry_sources_handles_duplicate_insert_integrity_error(monkeypatch) -> None:
    database = SessionLocal()
    original_commit = database.commit
    state = {"raised": False}

    def flaky_commit():
        if not state["raised"]:
            state["raised"] = True
            raise IntegrityError("INSERT INTO sources", {}, Exception("duplicate slug"))
        return original_commit()

    try:
        database.query(Source).delete()
        original_commit()
        monkeypatch.setattr(database, "commit", flaky_commit)

        result = sync_registry_sources(database)

        assert state["raised"] is True
        assert result["created"] >= 1
        assert database.query(Source).count() > 0
    finally:
        database.close()


def test_import_seed_invalid_scan_interval_rolls_back_seed_rows() -> None:
    reset_tables()
    seed = {
        "include_registry_sources": False,
        "sources": [
            {
                "name": "Valid Before Invalid",
                "slug": "valid-before-invalid",
                "base_url": "https://valid-before-invalid.example",
                "source_type": "manual_external",
                "status": "manual_only",
                "scan_interval_minutes": 60,
            },
            {
                "name": "Invalid Interval",
                "slug": "invalid-interval",
                "base_url": "https://invalid-interval.example",
                "source_type": "manual_external",
                "status": "manual_only",
                "scan_interval_minutes": "not-a-number",
            },
        ],
    }

    database = SessionLocal()
    try:
        try:
            import_seed_sources(database, seed)
            assert False, "Expected invalid seed to raise ValueError"
        except ValueError:
            pass

        assert database.query(Source).filter(Source.slug == "valid-before-invalid").count() == 0
        assert database.query(Source).filter(Source.slug == "invalid-interval").count() == 0
    finally:
        database.close()
