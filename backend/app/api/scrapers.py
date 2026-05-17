from datetime import datetime, timedelta
import logging
import time
from time import perf_counter
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.admin import require_admin
from app.core.config import settings
from app.database.db import get_database_session
from app.models.listing import Listing
from app.models.scan_history import ScanHistory
from app.scrapers.base import detect_availability_status
from app.services.duplicates import assign_duplicate_metadata, refresh_duplicate_group
from app.scrapers.generic_sources import SourceBlockedError
from app.services.listing_quality import (
    ListingQualityInput,
    build_listing_quality,
    build_display_title,
    clean_listing_description,
)
from app.services.scanner_reliability import (
    source_listing_signature,
    sanitize_scraped_listing,
    truncate_error_message,
)
from app.services.location import (
    AddressParts,
    enrich_location,
    extract_address_parts,
    merge_address_parts,
    reset_geocode_run_budget,
    slug_to_text,
)
from app.sources.registry import LAST_SOURCE_RUNS, enabled_sources


router = APIRouter(
    prefix="/api/scrapers",
    tags=["Scrapers"],
)


class ScraperRunRequest(BaseModel):
    city: str | None = None
    sources: list[str] | None = None


FRESHNESS_WINDOW_MINUTES = 60
logger = logging.getLogger("rentscout.scanner")


def normalize_city(city: str | None) -> str:
    normalized_city = " ".join((city or "").split()).strip()
    return normalized_city or settings.default_city


def serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None

    return value.isoformat()


def create_source_summary(source_id: str, source_name: str, manual_search_url: str | None) -> dict:
    return {
        "source_id": source_id,
        "source": source_name,
        "status": "failed",
        "scraped_count": 0,
        "created_count": 0,
        "updated_count": 0,
        "skipped_count": 0,
        "duplicate_count": 0,
        "error": None,
        "duration_ms": None,
        "manual_search_url": manual_search_url,
        "failure_type": None,
        "skip_reasons": {},
        "detail_pages_fetched": 0,
        "images_found": 0,
        "area_found": 0,
        "rooms_found": 0,
        "status_found": 0,
        "missing_image": 0,
        "missing_area": 0,
        "missing_rooms": 0,
        "availability_known": 0,
        "unavailable_detected": 0,
        "malformed_skipped": 0,
    }


def update_source_quality_summary(source_summary: dict, scraped_listing) -> None:
    diagnostics = scraped_listing.scrape_diagnostics or {}
    source_summary["detail_pages_fetched"] += int(diagnostics.get("detail_pages_fetched", 0))
    source_summary["images_found"] += 1 if scraped_listing.image_url else 0
    source_summary["area_found"] += 1 if scraped_listing.area_m2 is not None else 0
    source_summary["rooms_found"] += 1 if scraped_listing.rooms is not None else 0
    source_summary["status_found"] += (
        1 if scraped_listing.availability_status not in {None, "", "unknown"} else 0
    )
    source_summary["missing_image"] += 0 if scraped_listing.image_url else 1
    source_summary["missing_area"] += 0 if scraped_listing.area_m2 is not None else 1
    source_summary["missing_rooms"] += 0 if scraped_listing.rooms is not None else 1
    source_summary["availability_known"] += (
        1 if scraped_listing.availability_status not in {None, "", "unknown"} else 0
    )
    source_summary["unavailable_detected"] += (
        1 if scraped_listing.availability_status in {"rented", "reserved", "under_option"} else 0
    )


def record_scan_history(
    database: Session,
    *,
    city: str,
    source_id: str,
    status: str,
    scraped_count: int,
    created_count: int,
    updated_count: int,
    skipped_count: int = 0,
    duplicate_count: int = 0,
    duration_ms: int | None = None,
    error: str | None = None,
    started_at: datetime,
    finished_at: datetime,
) -> None:
    database.add(
        ScanHistory(
            city=city,
            source_id=source_id,
            status=status,
            scraped_count=scraped_count,
            created_count=created_count,
            updated_count=updated_count,
            skipped_count=skipped_count,
            duplicate_count=duplicate_count,
            duration_ms=duration_ms,
            error=error,
            started_at=started_at,
            finished_at=finished_at,
        )
    )
    database.commit()


def latest_scan_for_source(database: Session, city: str, source_id: str) -> ScanHistory | None:
    return (
        database.query(ScanHistory)
        .filter(
            func.lower(ScanHistory.city) == city.lower(),
            ScanHistory.source_id == source_id,
            ScanHistory.finished_at.isnot(None),
        )
        .order_by(ScanHistory.finished_at.desc())
        .first()
    )


def update_existing_listing(
    existing_listing: Listing,
    scraped_listing,
    listing_metadata: dict,
    source_key: str,
    city: str,
    now: datetime,
) -> None:
    clean_title = build_display_title(
        scraped_listing.title or existing_listing.title or "",
        address_text=scraped_listing.address_text,
        street_name=scraped_listing.street_name,
        house_number=scraped_listing.house_number,
        city=listing_metadata.get("city") or scraped_listing.city or city,
        property_type=listing_metadata.get("property_type") or existing_listing.property_type,
    )
    clean_description = clean_listing_description(scraped_listing.description, clean_title)

    existing_listing.title = clean_title or scraped_listing.title or existing_listing.title
    existing_listing.source = scraped_listing.source or existing_listing.source
    existing_listing.source_key = source_key or existing_listing.source_key
    existing_listing.city = listing_metadata.pop("city", None) or scraped_listing.city or city
    existing_listing.last_seen_at = now
    existing_listing.last_checked_at = now
    existing_listing.updated_at = now
    existing_listing.is_active = True

    optional_fields = {
        "price": scraped_listing.price,
        "area_m2": scraped_listing.area_m2,
        "rooms": scraped_listing.rooms,
        "image_url": scraped_listing.image_url,
        "description": clean_description or scraped_listing.description,
        "availability_status": scraped_listing.availability_status,
        "is_available": scraped_listing.is_available,
        "address_text": scraped_listing.address_text,
        "street_name": scraped_listing.street_name,
        "house_number": scraped_listing.house_number,
        "postal_code": scraped_listing.postal_code,
    }

    for field_name, field_value in optional_fields.items():
        if field_value not in (None, ""):
            setattr(existing_listing, field_name, field_value)

    for field_name, field_value in listing_metadata.items():
        setattr(existing_listing, field_name, field_value)

    apply_availability_fallback(existing_listing)
    assign_duplicate_metadata(existing_listing)


def apply_availability_fallback(listing: Listing) -> None:
    if listing.availability_status not in (None, "", "unknown"):
        return

    availability_status, is_available = detect_availability_status(
        " ".join([listing.title or "", listing.description or ""])
    )

    if availability_status == "unknown":
        return

    listing.availability_status = availability_status
    listing.is_available = is_available


def build_location_metadata(database: Session, scraped_listing, city: str) -> dict:
    explicit_precision = "unknown"
    explicit_confidence = 0.0
    if scraped_listing.street_name and scraped_listing.house_number:
        explicit_precision = "exact_address"
        explicit_confidence = 0.9
    elif scraped_listing.postal_code:
        explicit_precision = "postcode"
        explicit_confidence = 0.72

    explicit_parts = AddressParts(
        address_text=scraped_listing.address_text,
        street_name=scraped_listing.street_name,
        house_number=scraped_listing.house_number,
        postal_code=scraped_listing.postal_code,
        city=scraped_listing.city or city,
        location_precision=explicit_precision,
        location_confidence=explicit_confidence,
    )
    inferred_parts = extract_address_parts(
        " ".join(
            [
                scraped_listing.title or "",
                scraped_listing.description or "",
                slug_to_text(scraped_listing.url),
            ]
        ),
        scraped_listing.city or city,
    )
    merged_parts = merge_address_parts(explicit_parts, inferred_parts)
    return enrich_location(database, merged_parts)


_SOURCE_FETCH_EXECUTOR = ThreadPoolExecutor(max_workers=4)


def fetch_source_with_timeout(source, city: str):
    future = _SOURCE_FETCH_EXECUTOR.submit(source.fetch_listings, city)
    try:
        return future.result(timeout=source.timeout_seconds)
    except FutureTimeoutError as error:
        future.cancel()
        raise TimeoutError(
            f"Source scan exceeded {source.timeout_seconds}s timeout."
        ) from error


def mark_source_result(source, source_summary: dict, finished_at: datetime) -> None:
    source.last_scan_finished_at = finished_at
    source.listings_found_last_scan = source_summary["scraped_count"]

    if source_summary["status"] in {"success", "no_results"}:
        source.failure_count = 0
        source.last_success_at = finished_at
        source.status = "online" if source_summary["status"] == "success" else "degraded"
        return

    source.failure_count += 1
    source.last_error = source_summary["error"]
    source.status = "limited" if source_summary["status"] == "blocked" else "degraded"


def add_location_quality_boost(listing_metadata: dict, location_metadata: dict) -> None:
    boost_by_precision = {
        "exact_address": 0.05,
        "street": 0.035,
        "postcode": 0.03,
        "city": 0.0,
        "unknown": 0.0,
    }
    confidence_score = listing_metadata.get("confidence_score")

    if confidence_score is None:
        return

    boost = boost_by_precision.get(location_metadata.get("location_precision"), 0.0)
    listing_metadata["confidence_score"] = round(min(1.0, confidence_score + boost), 2)


LISTING_CREATION_RESERVED_KEYS = {
    "source_key",
    "title",
    "source",
    "url",
    "city",
    "price",
    "area_m2",
    "rooms",
    "image_url",
    "description",
    "availability_status",
    "is_available",
    "address_text",
    "street_name",
    "house_number",
    "postal_code",
    "latitude",
    "longitude",
    "location_precision",
    "location_confidence",
    "is_active",
    "first_seen_at",
    "last_seen_at",
    "last_checked_at",
}


def strip_reserved_listing_metadata(listing_metadata: dict) -> dict:
    return {
        key: value
        for key, value in listing_metadata.items()
        if key not in LISTING_CREATION_RESERVED_KEYS
    }


@router.post("/run", dependencies=[Depends(require_admin)])
def run_scrapers(
    request: ScraperRunRequest | None = None,
    database: Session = Depends(get_database_session),
):
    city = normalize_city(request.city if request else None)
    created_count = 0
    updated_count = 0
    duplicate_count = 0
    skipped_count = 0
    seen_urls = set()
    seen_source_signatures = set()
    created_listings = []
    source_summaries = []
    selected_source_ids = request.sources if request and request.sources is not None else None
    reset_geocode_run_budget()

    for source in enabled_sources(selected_source_ids, auto_only=selected_source_ids is None):
        perf_started_at = perf_counter()
        scan_started_at = datetime.utcnow()
        source.last_scan_started_at = scan_started_at
        source_summary = create_source_summary(
            source_id=source.source_key,
            source_name=source.display_name,
            manual_search_url=source.manual_search_url(city),
        )
        source_summaries.append(source_summary)
        logger.info(
            "scan_start source=%s source_name=%s city=%s timeout_seconds=%s",
            source.source_key,
            source.display_name,
            city,
            source.timeout_seconds,
        )

        scan_url_hint: str | None = source.manual_search_url(city) or source.base_url
        logger.info(
            "scan_query source=%s city=%s url=%s auto=%s reliability=%s",
            source.source_key,
            city,
            scan_url_hint,
            source.auto_scan_enabled,
            source.reliability_weight,
        )

        _max_block_retries = 2
        _block_retry_delay = 30
        _last_block_error: SourceBlockedError | None = None
        scraped_listings = None

        try:
            for _attempt in range(1 + _max_block_retries):
                try:
                    scraped_listings = fetch_source_with_timeout(source, city)
                    _last_block_error = None
                    break
                except SourceBlockedError as error:
                    _last_block_error = error
                    if _attempt < _max_block_retries:
                        logger.warning(
                            "scan_blocked_retrying source=%s attempt=%d/%d city=%s delay=%ds error=%s",
                            source.source_key,
                            _attempt + 1,
                            _max_block_retries,
                            city,
                            _block_retry_delay,
                            str(error),
                        )
                        time.sleep(_block_retry_delay)

            if _last_block_error is not None:
                source_summary["status"] = "blocked"
                source_summary["error"] = truncate_error_message(str(_last_block_error))
                source_summary["duration_ms"] = round((perf_counter() - perf_started_at) * 1000)
                source_summary["failure_type"] = "blocked"
                finished_at = datetime.utcnow()
                LAST_SOURCE_RUNS[source.source_key] = source_summary.copy()
                mark_source_result(source, source_summary, finished_at)
                record_scan_history(
                    database,
                    city=city,
                    source_id=source.source_key,
                    status=source_summary["status"],
                    scraped_count=source_summary["scraped_count"],
                    created_count=source_summary["created_count"],
                    updated_count=source_summary["updated_count"],
                    skipped_count=source_summary["skipped_count"],
                    duplicate_count=source_summary["duplicate_count"],
                    duration_ms=source_summary["duration_ms"],
                    error=source_summary["error"],
                    started_at=scan_started_at,
                    finished_at=finished_at,
                )
                logger.warning(
                    "scan_blocked source=%s source_name=%s city=%s attempts=%d duration_ms=%s error=%s",
                    source.source_key,
                    source.display_name,
                    city,
                    _max_block_retries + 1,
                    source_summary["duration_ms"],
                    source_summary["error"],
                )
                continue
        except TimeoutError as error:
            source_summary["status"] = "failed"
            source_summary["error"] = truncate_error_message(str(error))
            source_summary["duration_ms"] = round((perf_counter() - perf_started_at) * 1000)
            source_summary["failure_type"] = "timeout"
            finished_at = datetime.utcnow()
            LAST_SOURCE_RUNS[source.source_key] = source_summary.copy()
            mark_source_result(source, source_summary, finished_at)
            record_scan_history(
                database,
                city=city,
                source_id=source.source_key,
                status=source_summary["status"],
                scraped_count=source_summary["scraped_count"],
                created_count=source_summary["created_count"],
                updated_count=source_summary["updated_count"],
                skipped_count=source_summary["skipped_count"],
                duplicate_count=source_summary["duplicate_count"],
                duration_ms=source_summary["duration_ms"],
                error=source_summary["error"],
                started_at=scan_started_at,
                finished_at=finished_at,
            )
            logger.warning(
                "scan_timeout source=%s source_name=%s city=%s duration_ms=%s error=%s",
                source.source_key,
                source.display_name,
                city,
                source_summary["duration_ms"],
                source_summary["error"],
            )
            continue
        except Exception as error:
            source_summary["status"] = "failed"
            source_summary["error"] = truncate_error_message(str(error))
            source_summary["duration_ms"] = round((perf_counter() - perf_started_at) * 1000)
            source_summary["failure_type"] = "exception"
            finished_at = datetime.utcnow()
            LAST_SOURCE_RUNS[source.source_key] = source_summary.copy()
            mark_source_result(source, source_summary, finished_at)
            record_scan_history(
                database,
                city=city,
                source_id=source.source_key,
                status=source_summary["status"],
                scraped_count=source_summary["scraped_count"],
                created_count=source_summary["created_count"],
                updated_count=source_summary["updated_count"],
                skipped_count=source_summary["skipped_count"],
                duplicate_count=source_summary["duplicate_count"],
                duration_ms=source_summary["duration_ms"],
                error=source_summary["error"],
                started_at=scan_started_at,
                finished_at=finished_at,
            )
            logger.exception(
                "scan_failed source=%s source_name=%s city=%s duration_ms=%s error=%s",
                source.source_key,
                source.display_name,
                city,
                source_summary["duration_ms"],
                source_summary["error"],
            )
            continue

        source_summary["scraped_count"] = len(scraped_listings)
        source_summary["status"] = "success" if scraped_listings else "no_results"

        for scraped_listing in scraped_listings:
            sanitized_listing, skip_reason = sanitize_scraped_listing(
                scraped_listing,
                fallback_source=source.display_name,
                requested_city=city,
            )
            if sanitized_listing is None:
                skipped_count += 1
                source_summary["skipped_count"] += 1
                if skip_reason:
                    source_summary["skip_reasons"][skip_reason] = (
                        source_summary["skip_reasons"].get(skip_reason, 0) + 1
                    )
                source_summary["malformed_skipped"] += 1
                logger.info(
                    "scan_listing_skipped source=%s source_name=%s city=%s reason=%s",
                    source.source_key,
                    source.display_name,
                    city,
                    skip_reason,
                )
                continue

            scraped_listing = sanitized_listing
            update_source_quality_summary(source_summary, scraped_listing)

            if scraped_listing.url in seen_urls:
                duplicate_count += 1
                source_summary["duplicate_count"] += 1
                continue

            source_signature = source_listing_signature(scraped_listing, source.source_key, city)
            if source_signature and source_signature in seen_source_signatures:
                duplicate_count += 1
                source_summary["duplicate_count"] += 1
                continue

            seen_urls.add(scraped_listing.url)
            if source_signature:
                seen_source_signatures.add(source_signature)

            now = datetime.utcnow()
            listing_metadata = build_listing_quality(
                ListingQualityInput(
                    title=scraped_listing.title,
                    description=scraped_listing.description,
                    url=scraped_listing.url,
                    requested_city=city,
                    scraped_city=scraped_listing.city,
                    price=scraped_listing.price,
                    area_m2=scraped_listing.area_m2,
                    image_url=scraped_listing.image_url,
                    source_reliability_weight=source.reliability_weight,
                )
            )
            listing_metadata["source_key"] = source.source_key
            if scraped_listing.availability_status != "unknown":
                listing_metadata["availability_status"] = scraped_listing.availability_status
                listing_metadata["is_available"] = scraped_listing.is_available
            location_metadata = build_location_metadata(database, scraped_listing, city)
            add_location_quality_boost(listing_metadata, location_metadata)
            listing_metadata.update(location_metadata)
            listing_metadata.pop("source_key", None)

            existing_listing = database.query(Listing).filter(
                Listing.url == scraped_listing.url
            ).first()

            if existing_listing:
                previous_duplicate_group_id = existing_listing.duplicate_group_id
                updated_count += 1
                source_summary["updated_count"] += 1
                update_existing_listing(
                    existing_listing=existing_listing,
                    scraped_listing=scraped_listing,
                    listing_metadata=listing_metadata,
                    source_key=source.source_key,
                    city=city,
                    now=now,
                )
                refresh_duplicate_group(database, previous_duplicate_group_id)
                refresh_duplicate_group(database, existing_listing.duplicate_group_id)
                database.commit()
                continue

            listing_city = listing_metadata.pop("city", None) or scraped_listing.city or city
            availability_status = listing_metadata.pop(
                "availability_status",
                scraped_listing.availability_status,
            )
            is_available = listing_metadata.pop("is_available", scraped_listing.is_available)
            address_text = listing_metadata.pop("address_text", scraped_listing.address_text)
            street_name = listing_metadata.pop("street_name", scraped_listing.street_name)
            house_number = listing_metadata.pop("house_number", scraped_listing.house_number)
            postal_code = listing_metadata.pop("postal_code", scraped_listing.postal_code)
            latitude = listing_metadata.pop("latitude", None)
            longitude = listing_metadata.pop("longitude", None)
            location_precision = listing_metadata.pop("location_precision", "unknown")
            location_confidence = listing_metadata.pop("location_confidence", 0.0)
            listing_extra_metadata = strip_reserved_listing_metadata(listing_metadata)
            clean_title = build_display_title(
                scraped_listing.title,
                address_text=address_text,
                street_name=street_name,
                house_number=house_number,
                city=listing_city,
                property_type=listing_metadata.get("property_type"),
            )
            clean_description = clean_listing_description(scraped_listing.description, clean_title)

            listing = Listing(
                title=clean_title or scraped_listing.title,
                source=scraped_listing.source,
                source_key=source.source_key,
                url=scraped_listing.url,
                city=listing_city,
                price=scraped_listing.price,
                area_m2=scraped_listing.area_m2,
                rooms=scraped_listing.rooms,
                image_url=scraped_listing.image_url,
                description=clean_description or scraped_listing.description,
                availability_status=availability_status,
                is_available=is_available,
                address_text=address_text,
                street_name=street_name,
                house_number=house_number,
                postal_code=postal_code,
                latitude=latitude,
                longitude=longitude,
                location_precision=location_precision,
                location_confidence=location_confidence,
                is_active=True,
                first_seen_at=now,
                last_seen_at=now,
                last_checked_at=now,
                **listing_extra_metadata,
            )

            database.add(listing)
            apply_availability_fallback(listing)
            assign_duplicate_metadata(listing)
            database.commit()
            database.refresh(listing)
            refresh_duplicate_group(database, listing.duplicate_group_id)
            database.commit()

            created_count += 1
            source_summary["created_count"] += 1
            created_listings.append(
                {
                    "id": listing.id,
                    "title": listing.title,
                    "source": listing.source,
                    "price": listing.price,
                    "area_m2": listing.area_m2,
                    "rooms": listing.rooms,
                    "image_url": listing.image_url,
                    "url": listing.url,
                }
            )

        source_summary["duration_ms"] = round((perf_counter() - perf_started_at) * 1000)
        finished_at = datetime.utcnow()
        LAST_SOURCE_RUNS[source.source_key] = source_summary.copy()
        mark_source_result(source, source_summary, finished_at)
        record_scan_history(
            database,
            city=city,
            source_id=source.source_key,
            status=source_summary["status"],
            scraped_count=source_summary["scraped_count"],
            created_count=source_summary["created_count"],
            updated_count=source_summary["updated_count"],
            skipped_count=source_summary["skipped_count"],
            duplicate_count=source_summary["duplicate_count"],
            duration_ms=source_summary["duration_ms"],
            error=source_summary["error"],
            started_at=scan_started_at,
            finished_at=finished_at,
        )
        logger.info(
            "scan_finished source=%s source_name=%s city=%s status=%s scraped=%s created=%s updated=%s skipped=%s duplicates=%s detail_pages_fetched=%s images_found=%s missing_image=%s missing_area=%s missing_rooms=%s unavailable_detected=%s duration_ms=%s",
            source.source_key,
            source.display_name,
            city,
            source_summary["status"],
            source_summary["scraped_count"],
            source_summary["created_count"],
            source_summary["updated_count"],
            source_summary["skipped_count"],
            source_summary["duplicate_count"],
            source_summary["detail_pages_fetched"],
            source_summary["images_found"],
            source_summary["missing_image"],
            source_summary["missing_area"],
            source_summary["missing_rooms"],
            source_summary["unavailable_detected"],
            source_summary["duration_ms"],
        )

    return {
        "status": "completed",
        "city": city,
        "sources": source_summaries,
        "scraped_count": sum(source["scraped_count"] for source in source_summaries),
        "created_count": created_count,
        "updated_count": updated_count,
        "duplicate_count": duplicate_count,
        "skipped_count": skipped_count,
        "created_listings": created_listings,
    }


@router.get("/freshness")
def get_scraper_freshness(
    city: str | None = None,
    sources: str | None = None,
    database: Session = Depends(get_database_session),
):
    normalized_city = normalize_city(city)
    selected_source_ids = [
        source_id.strip()
        for source_id in (sources or "").split(",")
        if source_id.strip()
    ] or None
    cutoff = datetime.utcnow() - timedelta(minutes=FRESHNESS_WINDOW_MINUTES)
    source_freshness = []

    for source in enabled_sources(selected_source_ids, auto_only=selected_source_ids is None):
        latest_scan = latest_scan_for_source(database, normalized_city, source.source_id)
        finished_at = latest_scan.finished_at if latest_scan else None
        has_scan = latest_scan is not None
        is_source_fresh = bool(has_scan and finished_at and finished_at >= cutoff)
        state = "recent" if is_source_fresh else "stale"

        if not has_scan:
            state = "never_scanned"

        source_freshness.append(
            {
                "source_id": source.source_id,
                "source": source.display_name,
                "status": latest_scan.status if latest_scan else None,
                "scraped_count": latest_scan.scraped_count if latest_scan else 0,
                "created_count": latest_scan.created_count if latest_scan else 0,
                "updated_count": latest_scan.updated_count if latest_scan else 0,
                "error": latest_scan.error if latest_scan else None,
                "started_at": serialize_datetime(latest_scan.started_at if latest_scan else None),
                "finished_at": serialize_datetime(finished_at),
                "is_fresh": is_source_fresh,
                "state": state,
            }
        )

    finished_times = [
        scan["finished_at"]
        for scan in source_freshness
        if scan["finished_at"] is not None
    ]
    stale_sources = [
        scan["source_id"]
        for scan in source_freshness
        if not scan["is_fresh"]
    ]

    return {
        "city": normalized_city,
        "sources": source_freshness,
        "newest_finished_at": max(finished_times) if finished_times else None,
        "oldest_finished_at": min(finished_times) if finished_times else None,
        "is_fresh": len(stale_sources) == 0 and len(source_freshness) > 0,
        "stale_sources": stale_sources,
        "freshness_window_minutes": FRESHNESS_WINDOW_MINUTES,
    }
