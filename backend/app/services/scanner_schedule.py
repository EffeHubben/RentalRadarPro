from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import hashlib

from sqlalchemy import func

from app.models.listing import Listing
from app.models.scan_history import ScanHistory
from app.sources.registry import RENTAL_SOURCES, RentalSource, source_supports_city


FAILURE_BACKOFF_STATUSES = {
    "failed",
    "blocked",
    "blocked_or_forbidden",
    "timeout",
    "invalid_response",
    "parse_error",
    "geocoding_failed",
}
ZERO_RESULT_STATUSES = {"no_results", "source_returned_empty", "all_results_filtered_out"}
ZERO_RESULT_BACKOFF_THRESHOLD = 3


@dataclass(frozen=True)
class SourceScanDecision:
    source_key: str
    due: bool
    reason: str
    next_due_at: datetime | None = None
    score: float = 0.0


def stagger_seconds(source: RentalSource, city: str) -> int:
    digest = hashlib.sha1(f"{source.source_key}|{city.lower()}".encode("utf-8")).hexdigest()
    return int(digest[:4], 16) % max(60, source.interval_minutes * 60)


def recent_scans(database, source_key: str, city: str, limit: int = 5) -> list[ScanHistory]:
    return (
        database.query(ScanHistory)
        .filter(
            ScanHistory.source_id == source_key,
            func.lower(ScanHistory.city) == city.lower(),
            ScanHistory.finished_at.isnot(None),
        )
        .order_by(ScanHistory.finished_at.desc())
        .limit(limit)
        .all()
    )


def leading_status_count(scans: list[ScanHistory], statuses: set[str]) -> int:
    count = 0
    for scan in scans:
        if scan.status not in statuses:
            break
        count += 1
    return count


def active_listing_count(database, city: str) -> int:
    return int(
        database.query(func.count())
        .select_from(Listing)
        .filter(
            func.lower(Listing.city) == city.lower(),
            Listing.is_active.is_(True),
        )
        .scalar()
        or 0
    )


def scan_decision_for_source(
    database,
    city: str,
    source: RentalSource,
    *,
    now: datetime | None = None,
) -> SourceScanDecision:
    now = now or datetime.utcnow()

    if not source.enabled:
        return SourceScanDecision(source.source_key, False, "disabled")
    if not source.auto_scan_enabled:
        return SourceScanDecision(source.source_key, False, f"{source.source_type}_not_auto_scanned")
    if not source_supports_city(source, city):
        return SourceScanDecision(source.source_key, False, "unsupported_city")

    scans = recent_scans(database, source.source_key, city)
    if not scans:
        return SourceScanDecision(
            source.source_key,
            True,
            "never_scanned",
            score=source.priority + source.reliability_weight * 25,
        )

    latest = scans[0]
    base_interval = max(source.interval_minutes, 0)
    failure_streak = leading_status_count(scans, FAILURE_BACKOFF_STATUSES)
    zero_streak = leading_status_count(scans, ZERO_RESULT_STATUSES)
    backoff_multiplier = 1
    reason = "interval_due"

    if failure_streak:
        backoff_multiplier = 2 ** min(failure_streak, 3)
        reason = f"failure_backoff:{failure_streak}"
    elif zero_streak >= ZERO_RESULT_BACKOFF_THRESHOLD:
        backoff_multiplier = min(3, zero_streak)
        reason = f"zero_result_backoff:{zero_streak}"

    next_due_at = latest.finished_at + timedelta(
        minutes=base_interval * backoff_multiplier,
        seconds=stagger_seconds(source, city),
    )
    overdue_minutes = max(0.0, (now - next_due_at).total_seconds() / 60)
    if next_due_at > now:
        return SourceScanDecision(source.source_key, False, reason, next_due_at=next_due_at)

    created_recently = sum(scan.created_count for scan in scans[:3])
    score = (
        overdue_minutes
        + source.priority
        + source.reliability_weight * 25
        + min(created_recently, 20)
        - failure_streak * 30
        - max(0, zero_streak - 1) * 8
    )
    return SourceScanDecision(source.source_key, True, "due", next_due_at=next_due_at, score=score)


def source_scan_decisions_for_city(database, city: str) -> list[SourceScanDecision]:
    return [
        scan_decision_for_source(database, city, source)
        for source in RENTAL_SOURCES
    ]


def due_sources_for_city(database, city: str) -> list[str]:
    decisions = [
        decision
        for decision in source_scan_decisions_for_city(database, city)
        if decision.due
    ]
    decisions.sort(key=lambda decision: (-decision.score, decision.source_key))
    return [decision.source_key for decision in decisions]


def city_scan_score(database, city: str, due_source_keys: list[str], most_recent: datetime | None) -> float:
    stale_minutes = (
        24 * 60
        if most_recent is None
        else max(0.0, (datetime.utcnow() - most_recent).total_seconds() / 60)
    )
    low_inventory_boost = max(0, 25 - min(active_listing_count(database, city), 25))
    due_source_boost = len(due_source_keys) * 8
    return stale_minutes + low_inventory_boost + due_source_boost
