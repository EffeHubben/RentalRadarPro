from datetime import datetime, timedelta
from time import perf_counter

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.db import get_database_session
from app.models.listing import Listing
from app.models.scan_history import ScanHistory
from app.scrapers.base import detect_availability_status
from app.services.duplicates import assign_duplicate_metadata, refresh_duplicate_group
from app.scrapers.generic_sources import SourceBlockedError
from app.services.listing_quality import ListingQualityInput, build_listing_quality
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
    }


def record_scan_history(
    database: Session,
    *,
    city: str,
    source_id: str,
    status: str,
    scraped_count: int,
    created_count: int,
    updated_count: int,
    error: str | None,
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
    city: str,
    now: datetime,
) -> None:
    existing_listing.title = scraped_listing.title or existing_listing.title
    existing_listing.source = scraped_listing.source or existing_listing.source
    existing_listing.city = listing_metadata.pop("city", None) or scraped_listing.city or city
    existing_listing.last_seen_at = now
    existing_listing.updated_at = now
    existing_listing.is_active = True

    optional_fields = {
        "price": scraped_listing.price,
        "area_m2": scraped_listing.area_m2,
        "rooms": scraped_listing.rooms,
        "image_url": scraped_listing.image_url,
        "description": scraped_listing.description,
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


@router.post("/run")
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
    created_listings = []
    source_summaries = []
    selected_source_ids = request.sources if request and request.sources is not None else None
    reset_geocode_run_budget()

    for source in enabled_sources(selected_source_ids):
        perf_started_at = perf_counter()
        scan_started_at = datetime.utcnow()
        source_summary = create_source_summary(
            source_id=source.source_id,
            source_name=source.display_name,
            manual_search_url=source.manual_search_url(city),
        )
        source_summaries.append(source_summary)

        try:
            scraped_listings = source.fetch_listings(city)
        except SourceBlockedError as error:
            source_summary["status"] = "blocked"
            source_summary["error"] = str(error)
            source_summary["duration_ms"] = round((perf_counter() - perf_started_at) * 1000)
            LAST_SOURCE_RUNS[source.source_id] = source_summary.copy()
            record_scan_history(
                database,
                city=city,
                source_id=source.source_id,
                status=source_summary["status"],
                scraped_count=source_summary["scraped_count"],
                created_count=source_summary["created_count"],
                updated_count=source_summary["updated_count"],
                error=source_summary["error"],
                started_at=scan_started_at,
                finished_at=datetime.utcnow(),
            )
            continue
        except Exception as error:
            source_summary["status"] = "failed"
            source_summary["error"] = str(error)
            source_summary["duration_ms"] = round((perf_counter() - perf_started_at) * 1000)
            LAST_SOURCE_RUNS[source.source_id] = source_summary.copy()
            record_scan_history(
                database,
                city=city,
                source_id=source.source_id,
                status=source_summary["status"],
                scraped_count=source_summary["scraped_count"],
                created_count=source_summary["created_count"],
                updated_count=source_summary["updated_count"],
                error=source_summary["error"],
                started_at=scan_started_at,
                finished_at=datetime.utcnow(),
            )
            continue

        source_summary["scraped_count"] = len(scraped_listings)
        source_summary["status"] = "success" if scraped_listings else "no_results"

        for scraped_listing in scraped_listings:
            if not scraped_listing.url:
                skipped_count += 1
                source_summary["skipped_count"] += 1
                continue

            if scraped_listing.url in seen_urls:
                duplicate_count += 1
                source_summary["duplicate_count"] += 1
                continue

            seen_urls.add(scraped_listing.url)

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
                )
            )
            if scraped_listing.availability_status != "unknown":
                listing_metadata["availability_status"] = scraped_listing.availability_status
                listing_metadata["is_available"] = scraped_listing.is_available
            location_metadata = build_location_metadata(database, scraped_listing, city)
            add_location_quality_boost(listing_metadata, location_metadata)
            listing_metadata.update(location_metadata)

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
                    city=city,
                    now=now,
                )
                refresh_duplicate_group(database, previous_duplicate_group_id)
                refresh_duplicate_group(database, existing_listing.duplicate_group_id)
                database.commit()
                continue

            listing = Listing(
                title=scraped_listing.title,
                source=scraped_listing.source,
                url=scraped_listing.url,
                city=listing_metadata.pop("city", None) or scraped_listing.city or city,
                price=scraped_listing.price,
                area_m2=scraped_listing.area_m2,
                rooms=scraped_listing.rooms,
                image_url=scraped_listing.image_url,
                description=scraped_listing.description,
                availability_status=listing_metadata.pop(
                    "availability_status",
                    scraped_listing.availability_status,
                ),
                is_available=listing_metadata.pop("is_available", scraped_listing.is_available),
                address_text=listing_metadata.pop("address_text", scraped_listing.address_text),
                street_name=listing_metadata.pop("street_name", scraped_listing.street_name),
                house_number=listing_metadata.pop("house_number", scraped_listing.house_number),
                postal_code=listing_metadata.pop("postal_code", scraped_listing.postal_code),
                latitude=listing_metadata.pop("latitude", None),
                longitude=listing_metadata.pop("longitude", None),
                location_precision=listing_metadata.pop("location_precision", "unknown"),
                location_confidence=listing_metadata.pop("location_confidence", 0.0),
                is_active=True,
                last_seen_at=now,
                **listing_metadata,
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
        LAST_SOURCE_RUNS[source.source_id] = source_summary.copy()
        record_scan_history(
            database,
            city=city,
            source_id=source.source_id,
            status=source_summary["status"],
            scraped_count=source_summary["scraped_count"],
            created_count=source_summary["created_count"],
            updated_count=source_summary["updated_count"],
            error=source_summary["error"],
            started_at=scan_started_at,
            finished_at=datetime.utcnow(),
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

    for source in enabled_sources(selected_source_ids):
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
