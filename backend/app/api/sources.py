from datetime import datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.database.db import get_database_session
from app.models.scan_history import ScanHistory
from app.models.listing import Listing
from app.sources.registry import RENTAL_SOURCES, source_payload
from app.services.scanner_reliability import truncate_error_message


router = APIRouter(
    prefix="/api/sources",
    tags=["Sources"],
)


def latest_scan_for_source(database: Session, city: str | None, source_id: str) -> ScanHistory | None:
    query = database.query(ScanHistory).filter(ScanHistory.source_id == source_id)
    if city:
        query = query.filter(func.lower(ScanHistory.city) == city.lower())

    return query.order_by(ScanHistory.finished_at.desc()).first()


def latest_success_for_source(database: Session, city: str | None, source_id: str) -> ScanHistory | None:
    query = database.query(ScanHistory).filter(
        ScanHistory.source_id == source_id,
        ScanHistory.status.in_(["success", "no_results"]),
    )
    if city:
        query = query.filter(func.lower(ScanHistory.city) == city.lower())

    return query.order_by(ScanHistory.finished_at.desc()).first()


def latest_failure_for_source(database: Session, city: str | None, source_id: str) -> ScanHistory | None:
    query = database.query(ScanHistory).filter(
        ScanHistory.source_id == source_id,
        ScanHistory.status.in_(["failed", "blocked"]),
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
    if scan_status == "failed":
        return "degraded"
    if scan_status == "blocked":
        return "limited"

    return source_status


def next_due_from_scan(source, latest_scan: ScanHistory | None) -> str | None:
    if not source.auto_scan_enabled or not latest_scan or not latest_scan.finished_at:
        return None

    backoff_minutes = 0
    if latest_scan.status in {"failed", "blocked"}:
        backoff_minutes = source.interval_minutes * 2

    interval = max(source.interval_minutes, backoff_minutes)
    next_due_at = latest_scan.finished_at + timedelta(
        minutes=interval,
        seconds=source.stagger_seconds(),
    )
    return next_due_at.isoformat()


def build_sources_payloads(database: Session, city: str | None = None) -> list[dict]:
    payloads = []
    for source in RENTAL_SOURCES:
        payload = source_payload(source, city=city)
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

        if latest_scan:
            payload.update(
                {
                    "status": public_status_for_scan(source.status, latest_scan.status),
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
                    "next_due_at": next_due_from_scan(source, latest_scan),
                }
            )

        if latest_success:
            payload["last_success_at"] = latest_success.finished_at.isoformat() if latest_success.finished_at else None
        if latest_failure:
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
