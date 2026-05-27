from __future__ import annotations

import re
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.source import SCANNABLE_SOURCE_TYPES, SCAN_ENABLED_STATUS, Source, SourceStatus, SourceType
from app.sources.registry import RENTAL_SOURCES, RentalSource


SOURCE_TYPE_VALUES = {value.value for value in SourceType}
SOURCE_STATUS_VALUES = {value.value for value in SourceStatus}

SUCCESS_SCAN_STATUSES = {"success", "source_returned_empty", "duplicate_only", "no_results"}


def slugify_source(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return normalized.strip("-") or "source"


def registry_source_type(source: RentalSource) -> str:
    if source.source_type == "api":
        return SourceType.API.value
    if source.source_type in {"rss", "sitemap"}:
        return SourceType.FEED.value
    if source.source_type == "partner":
        return SourceType.PARTNER_IMPORT.value
    if source.source_type == "manual" or not source.supports_automatic_scraping:
        return SourceType.MANUAL_EXTERNAL.value
    if source.source_type in {"direct_scraper", "generic_html"}:
        return SourceType.SCRAPER_ACTIVE.value
    return SourceType.UNSUPPORTED.value


def registry_source_status(source: RentalSource) -> str:
    mapped_type = registry_source_type(source)
    if mapped_type == SourceType.MANUAL_EXTERNAL.value:
        return SourceStatus.MANUAL_ONLY.value
    if mapped_type == SourceType.UNSUPPORTED.value:
        return SourceStatus.UNSUPPORTED.value
    if source.status in {"online", "degraded"} and source.auto_scan_enabled:
        return SourceStatus.ACTIVE.value
    if source.status == "manual":
        return SourceStatus.MANUAL_ONLY.value
    if source.status == "limited":
        return SourceStatus.NEEDS_REVIEW.value
    if source.status == "offline":
        return SourceStatus.PAUSED.value
    return SourceStatus.NEEDS_REVIEW.value


def registry_source_defaults(source: RentalSource) -> dict[str, Any]:
    return {
        "name": source.display_name,
        "slug": source.source_key,
        "base_url": source.base_url,
        "country": source.country or "NL",
        "city": ",".join(source.supported_cities) if source.supported_cities else None,
        "region": ",".join(source.supported_regions) if source.supported_regions else None,
        "source_type": registry_source_type(source),
        "status": registry_source_status(source),
        "is_enabled": bool(source.enabled),
        "scrape_priority": int(source.priority or 50),
        "requires_login": bool(source.requires_login),
        "has_anti_bot": bool(source.likely_blocks_bots),
        "robots_policy": source.respect_notes,
        "scan_interval_minutes": int(source.scan_interval_minutes or settings.listing_scan_interval_minutes),
        "notes": source.notes,
    }


def normalize_source_type(value: str | None) -> str:
    if value in SOURCE_TYPE_VALUES:
        return value
    return SourceType.MANUAL_EXTERNAL.value


def normalize_source_status(value: str | None) -> str:
    if value in SOURCE_STATUS_VALUES:
        return value
    return SourceStatus.NEEDS_REVIEW.value


def is_scannable_source_record(source: Source) -> bool:
    return (
        bool(source.is_enabled)
        and source.source_type in SCANNABLE_SOURCE_TYPES
        and source.status == SCAN_ENABLED_STATUS
    )


def source_skip_reason(source: Source) -> str | None:
    if not source.is_enabled:
        return "disabled"
    if source.source_type == SourceType.MANUAL_EXTERNAL.value:
        return "manual_external"
    if source.source_type == SourceType.PARTNER_IMPORT.value:
        return "partner_import_not_auto_scanned"
    if source.source_type == SourceType.UNSUPPORTED.value:
        return "unsupported_source_type"
    if source.source_type not in SCANNABLE_SOURCE_TYPES:
        return f"{source.source_type}_not_scannable"
    if source.status != SCAN_ENABLED_STATUS:
        return f"status_{source.status}"
    return None


def sync_registry_sources(database: Session, *, update_existing: bool = False) -> dict[str, int]:
    created = 0
    updated = 0
    for registry_source in RENTAL_SOURCES:
        defaults = registry_source_defaults(registry_source)
        existing = database.query(Source).filter(Source.slug == defaults["slug"]).first()
        if existing is None:
            database.add(Source(**defaults))
            try:
                database.commit()
                created += 1
            except IntegrityError:
                database.rollback()
            continue

        if not update_existing:
            continue

        for key, value in defaults.items():
            if key == "slug":
                continue
            setattr(existing, key, value)
        updated += 1

    database.commit()
    return {"created": created, "updated": updated}


def source_records_by_slug(database: Session) -> dict[str, Source]:
    sync_registry_sources(database)
    return {source.slug: source for source in database.query(Source).all()}


def get_source_record(database: Session, slug: str) -> Source | None:
    sync_registry_sources(database)
    return database.query(Source).filter(Source.slug == slug).first()


def select_runtime_sources(
    database: Session,
    source_ids: list[str] | None = None,
    *,
    auto_only: bool = False,
) -> list[RentalSource]:
    records = source_records_by_slug(database)
    selected_ids = set(source_ids or [])
    selected: list[RentalSource] = []

    for registry_source in RENTAL_SOURCES:
        record = records.get(registry_source.source_key)
        if record is None:
            continue
        if source_ids is not None and registry_source.source_id not in selected_ids:
            continue
        if source_ids is None and auto_only and not is_scannable_source_record(record):
            continue
        if source_ids is None and not record.is_enabled:
            continue
        selected.append(registry_source)

    return selected


def update_source_scan_metadata(
    database: Session,
    *,
    source_id: str,
    status: str,
    error: str | None,
    checked_at: datetime,
) -> None:
    source = database.query(Source).filter(Source.slug == source_id).first()
    if source is None:
        return

    source.last_checked_at = checked_at
    source.last_error = error
    if status in SUCCESS_SCAN_STATUSES:
        source.last_success_at = checked_at


def source_to_admin_payload(source: Source) -> dict[str, Any]:
    return {
        "id": source.id,
        "name": source.name,
        "slug": source.slug,
        "base_url": source.base_url,
        "country": source.country,
        "city": source.city,
        "region": source.region,
        "source_type": source.source_type,
        "status": source.status,
        "is_enabled": bool(source.is_enabled),
        "scrape_priority": source.scrape_priority,
        "requires_login": bool(source.requires_login),
        "has_anti_bot": bool(source.has_anti_bot),
        "robots_policy": source.robots_policy,
        "scan_interval_minutes": source.scan_interval_minutes,
        "last_checked_at": source.last_checked_at,
        "last_success_at": source.last_success_at,
        "last_error": source.last_error,
        "notes": source.notes,
        "created_at": source.created_at,
        "updated_at": source.updated_at,
        "is_scannable": is_scannable_source_record(source),
        "scan_skip_reason": source_skip_reason(source),
    }


def list_admin_sources(database: Session) -> list[dict[str, Any]]:
    sync_registry_sources(database)
    records = database.query(Source).order_by(Source.scrape_priority.desc(), Source.name.asc()).all()
    return [source_to_admin_payload(source) for source in records]


def upsert_source(database: Session, payload: dict[str, Any], *, commit: bool = True) -> tuple[Source, bool]:
    slug = payload.get("slug") or slugify_source(payload.get("name") or payload.get("base_url") or "")
    base_url = payload.get("base_url")
    query = database.query(Source).filter(Source.slug == slug)
    if base_url:
        query = database.query(Source).filter(or_(Source.slug == slug, Source.base_url == base_url))
    source = query.first()
    created = False

    if source is None:
        source = Source(
            name=payload.get("name") or slug,
            slug=slug,
            base_url=base_url or f"https://{slug}.invalid",
        )
        database.add(source)
        created = True

    for key in (
        "name",
        "base_url",
        "country",
        "city",
        "region",
        "source_type",
        "status",
        "is_enabled",
        "scrape_priority",
        "requires_login",
        "has_anti_bot",
        "robots_policy",
        "scan_interval_minutes",
        "last_error",
        "notes",
    ):
        if key not in payload:
            continue
        value = payload[key]
        if key == "source_type":
            value = normalize_source_type(value)
        elif key == "status":
            value = normalize_source_status(value)
        elif key == "country":
            value = (value or "NL")[:2].upper()
        elif key == "scan_interval_minutes":
            value = max(1, int(value or settings.listing_scan_interval_minutes))
        elif key == "scrape_priority":
            value = int(value or 50)
        setattr(source, key, value)

    source.updated_at = datetime.utcnow()
    if commit:
        try:
            database.commit()
        except IntegrityError:
            database.rollback()
            source = database.query(Source).filter(Source.slug == slug).first()
            if source is None and base_url:
                source = database.query(Source).filter(Source.base_url == base_url).first()
            if source is None:
                raise
            created = False
        database.refresh(source)
    else:
        database.flush()
    return source, created


def import_seed_sources(database: Session, seed: dict[str, Any], *, update_registry: bool = False) -> dict[str, int]:
    normalized_sources = [normalize_seed_source(raw_source) for raw_source in seed.get("sources", [])]
    created = 0
    updated = 0
    if seed.get("include_registry_sources", False):
        result = sync_registry_sources(database, update_existing=update_registry)
        created += result["created"]
        updated += result["updated"]

    try:
        for normalized in normalized_sources:
            _, was_created = upsert_source(database, normalized, commit=False)
            created += 1 if was_created else 0
            updated += 0 if was_created else 1
        database.commit()
    except Exception:
        database.rollback()
        raise

    return {"created": created, "updated": updated}


def normalize_seed_source(raw_source: dict[str, Any]) -> dict[str, Any]:
    source_type = raw_source.get("source_type")
    status_value = raw_source.get("status")
    recommended_mode = raw_source.get("recommended_mode")

    if source_type not in SOURCE_TYPE_VALUES:
        if recommended_mode in {"manual_external", "manual"}:
            source_type = SourceType.MANUAL_EXTERNAL.value
        elif recommended_mode in {"api"}:
            source_type = SourceType.API.value
        elif recommended_mode in {"feed", "rss", "sitemap"}:
            source_type = SourceType.FEED.value
        else:
            source_type = SourceType.MANUAL_EXTERNAL.value

    if status_value not in SOURCE_STATUS_VALUES:
        status_value = (
            SourceStatus.MANUAL_ONLY.value
            if source_type in {SourceType.MANUAL_EXTERNAL.value, SourceType.PARTNER_IMPORT.value}
            else SourceStatus.NEEDS_REVIEW.value
        )

    base_url = raw_source.get("base_url") or raw_source.get("url") or ""
    name = raw_source.get("name") or urlparse(base_url).netloc or "Unnamed source"
    scan_interval_minutes = parse_positive_int(
        raw_source.get("scan_interval_minutes"),
        "scan_interval_minutes",
        default=settings.listing_scan_interval_minutes,
    )
    scrape_priority = parse_positive_int(
        raw_source.get("scrape_priority") or raw_source.get("priority"),
        "scrape_priority",
        default=50,
        minimum=0,
    )

    return {
        "name": name,
        "slug": raw_source.get("slug") or slugify_source(name),
        "base_url": base_url,
        "country": raw_source.get("country") or "NL",
        "city": raw_source.get("city") or raw_source.get("matched_city") or None,
        "region": raw_source.get("region"),
        "source_type": source_type,
        "status": status_value,
        "is_enabled": bool(raw_source.get("is_enabled", True)),
        "scrape_priority": scrape_priority,
        "requires_login": bool(raw_source.get("requires_login") or raw_source.get("requires_login_guess") or False),
        "has_anti_bot": bool(raw_source.get("has_anti_bot") or raw_source.get("paywall_guess") or False),
        "robots_policy": raw_source.get("robots_policy") or raw_source.get("robots_txt_status"),
        "scan_interval_minutes": scan_interval_minutes,
        "notes": raw_source.get("notes"),
    }


def parse_positive_int(value: Any, field_name: str, *, default: int, minimum: int = 1) -> int:
    if value in (None, ""):
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{field_name} must be numeric") from error
    if parsed < minimum:
        raise ValueError(f"{field_name} must be at least {minimum}")
    return parsed
