from datetime import datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.database.db import get_database_session
from app.models.scan_history import ScanHistory
from app.models.listing import Listing
from app.sources.registry import RENTAL_SOURCES, source_payload
from app.services.scanner_schedule import scan_decision_for_source
from app.services.scanner_reliability import truncate_error_message
from app.models.source import SourceStatus, SourceType
from app.services.source_catalog import is_scannable_source_record, source_records_by_slug, source_skip_reason


router = APIRouter(
    prefix="/api/sources",
    tags=["Sources"],
)

SUCCESS_SCAN_STATUSES = {"success", "no_results", "source_returned_empty", "duplicate_only"}
FAILURE_SCAN_STATUSES = {
    "failed",
    "blocked",
    "blocked_or_forbidden",
    "timeout",
    "invalid_response",
    "parse_error",
    "geocoding_failed",
}


def latest_scan_for_source(database: Session, city: str | None, source_id: str) -> ScanHistory | None:
    query = database.query(ScanHistory).filter(ScanHistory.source_id == source_id)
    if city:
        query = query.filter(func.lower(ScanHistory.city) == city.lower())

    return query.order_by(ScanHistory.finished_at.desc()).first()


def latest_success_for_source(database: Session, city: str | None, source_id: str) -> ScanHistory | None:
    query = database.query(ScanHistory).filter(
        ScanHistory.source_id == source_id,
        ScanHistory.status.in_(SUCCESS_SCAN_STATUSES),
    )
    if city:
        query = query.filter(func.lower(ScanHistory.city) == city.lower())

    return query.order_by(ScanHistory.finished_at.desc()).first()


def latest_failure_for_source(database: Session, city: str | None, source_id: str) -> ScanHistory | None:
    query = database.query(ScanHistory).filter(
        ScanHistory.source_id == source_id,
        ScanHistory.status.in_(FAILURE_SCAN_STATUSES),
    )
    if city:
        query = query.filter(func.lower(ScanHistory.city) == city.lower())

    return query.order_by(ScanHistory.finished_at.desc()).first()


def listings_added_today(database: Session, city: str | None, source_id: str) -> int:
    today_start = datetime.combine(datetime.utcnow().date(), time.min)
    query = database.query(func.coalesce(func.sum(ScanHistory.created_count), 0)).filter(
        ScanHistory.source_id == source_id,
        ScanHistory.started_at >= today_start,
    )
    if city:
        query = query.filter(func.lower(ScanHistory.city) == city.lower())

    return int(query.scalar() or 0)


def listing_counts_for_source(database: Session, city: str | None, source_id: str) -> tuple[int, int]:
    query = database.query(
        func.count(Listing.id),
        func.coalesce(func.sum(case((Listing.is_active.is_(True), 1), else_=0)), 0),
    ).filter(Listing.source_key == source_id)
    if city:
        query = query.filter(func.lower(Listing.city) == city.lower())

    total_count, active_count = query.one()
    return int(total_count or 0), int(active_count or 0)


def public_status_for_scan(source_status: str, scan_status: str | None) -> str:
    if scan_status in {"failed", "timeout", "invalid_response", "parse_error", "geocoding_failed"}:
        return "degraded"
    if scan_status in {"blocked", "blocked_or_forbidden"}:
        return "limited"
    if scan_status == "all_results_filtered_out":
        return "degraded"

    return source_status


def public_status_for_source_record(record, fallback_status: str) -> str:
    if record is None:
        return fallback_status
    if record.status == SourceStatus.ACTIVE.value:
        return "online"
    if record.status == SourceStatus.MANUAL_ONLY.value:
        return "manual"
    if record.status in {SourceStatus.BLOCKED.value, SourceStatus.NEEDS_REVIEW.value}:
        return "limited"
    if record.status in {SourceStatus.PAUSED.value, SourceStatus.UNSUPPORTED.value}:
        return "offline"
    return fallback_status


def next_due_from_scan(source, latest_scan: ScanHistory | None) -> str | None:
    if not source.auto_scan_enabled or not latest_scan or not latest_scan.finished_at:
        return None

    backoff_minutes = 0
    if latest_scan.status in FAILURE_SCAN_STATUSES:
        backoff_minutes = source.interval_minutes * 2

    interval = max(source.interval_minutes, backoff_minutes)
    next_due_at = latest_scan.finished_at + timedelta(
        minutes=interval,
        seconds=source.stagger_seconds(),
    )
    return next_due_at.isoformat()


def build_sources_payloads(database: Session, city: str | None = None) -> list[dict]:
    payloads = []
    records = source_records_by_slug(database)
    for source in RENTAL_SOURCES:
        record = records.get(source.source_key)
        configured_auto_scan = is_scannable_source_record(record) if record is not None else source.auto_scan_enabled
        configured_skip_reason = source_skip_reason(record) if record is not None else None
        manual_external = (
            configured_skip_reason == "manual_external"
            or not source.supports_automatic_scraping
            or source.source_type == "manual"
            or (record is not None and record.source_type in {SourceType.MANUAL_EXTERNAL.value, SourceType.PARTNER_IMPORT.value})
        )
        payload = source_payload(source, city=city)
        if record is not None:
            payload.update(
                {
                    "enabled": bool(record.is_enabled),
                    "is_enabled": bool(record.is_enabled),
                    "auto_scan_enabled": configured_auto_scan,
                    "default_enabled_for_auto_scan": configured_auto_scan,
                    "scan_interval_minutes": record.scan_interval_minutes,
                    "source_type": record.source_type,
                    "source_status": record.status,
                    "status": public_status_for_source_record(record, payload["status"]),
                    "requires_login": bool(record.requires_login),
                    "likely_blocks_bots": bool(record.has_anti_bot),
                    "priority": record.scrape_priority,
                    "notes": record.notes or payload["notes"],
                    "last_checked_at": record.last_checked_at.isoformat() if record.last_checked_at else None,
                }
            )
        if city:
            decision = scan_decision_for_source(database, city, source, source_record=record)
            payload.update(
                {
                    "scan_state": "due" if decision.due else "skipped",
                    "scan_skip_reason": None if decision.due else "manual_external" if manual_external else decision.reason,
                    "is_cooling_down": (not decision.due and decision.next_due_at is not None),
                    "next_due_at": decision.next_due_at.isoformat() if decision.next_due_at else payload.get("next_due_at"),
                }
            )
        else:
            payload.update(
                {
                    "scan_state": "manual" if not configured_auto_scan else "auto",
                    "scan_skip_reason": (
                        None
                        if configured_auto_scan
                        else "manual_external" if manual_external else configured_skip_reason or f"{source.source_type}_not_auto_scanned"
                    ),
                    "is_cooling_down": False,
                }
            )
        latest_scan = latest_scan_for_source(database, city, source.source_key)
        latest_success = latest_success_for_source(database, city, source.source_key)
        latest_failure = latest_failure_for_source(database, city, source.source_key)
        total_listing_count, active_listing_count = listing_counts_for_source(database, city, source.source_key)

        payload.update(
            {
                "total_listing_count": total_listing_count,
                "active_listing_count": active_listing_count,
                "listings_added_today": listings_added_today(database, city, source.source_key),
            }
        )

        if latest_scan and not manual_external:
            payload.update(
                {
                    "status": public_status_for_scan(payload["status"], latest_scan.status),
                    "last_scan_started_at": latest_scan.started_at.isoformat() if latest_scan.started_at else None,
                    "last_scan_finished_at": latest_scan.finished_at.isoformat() if latest_scan.finished_at else None,
                    "last_error": truncate_error_message(latest_scan.error),
                    "listings_found_last_scan": latest_scan.scraped_count,
                    "last_run": {
                        "source_id": latest_scan.source_id,
                        "source": source.display_name,
                        "status": latest_scan.status,
                        "scraped_count": latest_scan.scraped_count,
                        "created_count": latest_scan.created_count,
                        "updated_count": latest_scan.updated_count,
                        "skipped_count": latest_scan.skipped_count,
                        "duplicate_count": latest_scan.duplicate_count,
                        "duration_ms": latest_scan.duration_ms,
                        "error": truncate_error_message(latest_scan.error),
                        "started_at": latest_scan.started_at.isoformat() if latest_scan.started_at else None,
                        "finished_at": latest_scan.finished_at.isoformat() if latest_scan.finished_at else None,
                    },
                }
            )
            if not city:
                payload["next_due_at"] = next_due_from_scan(source, latest_scan)

        if latest_success and not manual_external:
            payload["last_success_at"] = latest_success.finished_at.isoformat() if latest_success.finished_at else None
        if latest_failure and not manual_external:
            payload["last_failed_at"] = latest_failure.finished_at.isoformat() if latest_failure.finished_at else None
            payload["last_failed_error"] = truncate_error_message(latest_failure.error)

        payloads.append(payload)

    return payloads


@router.get("/")
def get_sources(
    city: str | None = Query(default=None),
    database: Session = Depends(get_database_session),
):
    return build_sources_payloads(database, city=city)
