from typing import Literal
from datetime import datetime, timedelta
import math

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import and_, case, or_
from sqlalchemy.orm import Session

from app.core.admin import require_admin
from app.core.security import get_optional_user
from app.core.subscription import is_pro
from app.database.db import get_database_session
from app.models.listing import Listing
from app.models.user import User
from app.services.duplicates import duplicate_sources_for_listings
from app.services.listing_quality import clean_listing_description, clean_listing_title
from app.schemas.listing import (
    ListingCreate,
    ListingPreviewResponse,
    ListingResponse,
    ListingsPageResponse,
    ListingSitemapItem,
)


router = APIRouter(
    prefix="/api/listings",
    tags=["Listings"]
)

FREE_LISTING_LIMIT = 10
BEST_MATCH_DIVERSITY_WINDOW = 36
BEST_MATCH_MAX_RANK_JUMP = 8
BEST_MATCH_COMPARABLE_SCORE_GAP = 0.16
_RADIUS_MAX_CANDIDATES = 2000


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(min(1.0, a)))


def _listing_source_id(listing: Listing) -> str:
    return (listing.source_key or listing.source or "unknown").strip().lower() or "unknown"


def _listing_quality_score(listing: Listing) -> float:
    score = float(listing.confidence_score or 0.0)
    if listing.image_url:
        score += 0.035
    if clean_listing_title(listing.title or ""):
        score += 0.025
    if clean_listing_description(listing.description, listing.title):
        score += 0.025
    if listing.price is not None:
        score += 0.025
    if listing.area_m2 is not None:
        score += 0.02
    if listing.city:
        score += 0.02
    if listing.location_precision in {"exact_address", "street", "postcode"}:
        score += 0.03
    return min(score, 1.0)


def _diversify_best_match_listings(
    listings: list[Listing],
    *,
    window: int = BEST_MATCH_DIVERSITY_WINDOW,
    max_rank_jump: int = BEST_MATCH_MAX_RANK_JUMP,
    comparable_score_gap: float = BEST_MATCH_COMPARABLE_SCORE_GAP,
) -> list[Listing]:
    """Gently interleave comparable best-match results without hiding relevance."""
    if len(listings) < 3:
        return listings

    source_counts = {
        _listing_source_id(listing)
        for listing in listings[:window]
    }
    if len(source_counts) <= 1:
        return listings

    head = listings[:window]
    tail = listings[window:]
    best_score = max(_listing_quality_score(listing) for listing in head)
    comparable_floor = max(0.0, best_score - comparable_score_gap)
    remaining = list(enumerate(head))
    selected: list[tuple[int, Listing]] = []
    emitted_by_source: dict[str, int] = {}

    while remaining:
        output_index = len(selected)
        eligible: list[tuple[int, int, Listing]] = []

        for position, (original_index, listing) in enumerate(remaining):
            rank_jump = original_index - output_index
            if rank_jump > max_rank_jump:
                continue
            if _listing_quality_score(listing) < comparable_floor:
                continue
            eligible.append((position, original_index, listing))

        if not eligible:
            selected.append(remaining.pop(0))
            source_id = _listing_source_id(selected[-1][1])
            emitted_by_source[source_id] = emitted_by_source.get(source_id, 0) + 1
            continue

        def diversity_key(candidate: tuple[int, int, Listing]) -> tuple[int, int, int]:
            _, original_index, listing = candidate
            source_id = _listing_source_id(listing)
            return (
                emitted_by_source.get(source_id, 0),
                original_index,
                listing.id or 0,
            )

        selected_position, _, selected_listing = min(eligible, key=diversity_key)
        selected.append(remaining.pop(selected_position))
        selected_source = _listing_source_id(selected_listing)
        emitted_by_source[selected_source] = emitted_by_source.get(selected_source, 0) + 1

    return [listing for _, listing in selected] + tail


def _make_preview_listing(listing: Listing) -> ListingResponse:
    """Return a sanitized ListingResponse that reveals only preview-safe fields."""
    now = datetime.utcnow()
    return ListingResponse(
        id=listing.id,
        title="",
        source="",
        source_key=None,
        url="#",
        city=listing.city,
        price=listing.price,
        area_m2=None,
        rooms=None,
        property_type=listing.property_type,
        private_kitchen=None,
        private_bathroom=None,
        private_toilet=None,
        shared_laundry=None,
        is_shared=None,
        is_woningruil=False,
        availability_status=listing.availability_status,
        is_available=None,
        confidence_score=None,
        image_url=listing.image_url,
        description=None,
        address_text=None,
        street_name=None,
        house_number=None,
        postal_code=None,
        latitude=None,
        longitude=None,
        location_precision="city",
        location_confidence=0.0,
        duplicate_key=None,
        canonical_key=None,
        duplicate_group_id=None,
        source_count=1,
        is_active=listing.is_active if listing.is_active is not None else True,
        created_at=listing.created_at or now,
        updated_at=listing.updated_at or now,
        first_seen_at=listing.first_seen_at,
        last_seen_at=listing.last_seen_at,
        last_checked_at=None,
        duplicate_sources=[],
    )


@router.get("/", response_model=ListingsPageResponse)
def get_listings(
    request: Request,
    city: str | None = Query(default=None),
    cities: str | None = Query(default=None, description="Comma-separated list of city names"),
    source: str | None = Query(default=None),
    sources: str | None = Query(default=None, description="Comma-separated allowlist of source identifiers (display name or source_key)"),
    exclude_sources: str | None = Query(default=None, description="Comma-separated denylist of source identifiers"),
    min_price: int | None = Query(default=None, ge=0),
    max_price: int | None = Query(default=None, ge=0),
    no_max_price: bool = Query(default=False),
    include_unknown_price: bool = Query(default=True),
    min_area_m2: int | None = Query(default=None, ge=0),
    max_area_m2: int | None = Query(default=None, ge=0),
    min_rooms: int | None = Query(default=None, ge=0),
    property_type: Literal[
        "studio",
        "apartment",
        "room",
        "house",
        "parking",
        "unknown",
    ] | None = Query(default=None),
    property_types: str | None = Query(default=None),
    private_kitchen: bool | None = Query(default=None),
    private_bathroom: bool | None = Query(default=None),
    private_toilet: bool | None = Query(default=None),
    allow_shared: bool | None = Query(default=None),
    allow_shared_laundry: bool | None = Query(default=None),
    has_image: bool | None = Query(default=None),
    seen_recently_days: int | None = Query(default=None, ge=0, le=365),
    min_confidence_score: float | None = Query(default=None, ge=0, le=1),
    exclude_woningruil: bool = Query(default=False),
    exclude_parking: bool = Query(default=False),
    hide_rented: bool = Query(default=True),
    available_now: bool = Query(default=False, description="Only listings explicitly marked available."),
    only_independent: bool = Query(default=False),
    search: str | None = Query(default=None),
    location_lat: float | None = Query(default=None, description="Latitude of center point for radius search"),
    location_lng: float | None = Query(default=None, description="Longitude of center point for radius search"),
    radius_km: float | None = Query(default=None, ge=1, le=200, description="Search radius in km"),
    sort: Literal[
        "best_match",
        "newest",
        "recently_updated",
        "cheapest",
        "most_expensive",
        "best_quality",
    ] = Query(default="newest"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User | None = Depends(get_optional_user),
    database: Session = Depends(get_database_session),
):
    query = database.query(Listing)
    requested_property_types = []

    for value in request.query_params.getlist("property_type"):
        requested_property_types.extend(
            property_type_value.strip()
            for property_type_value in value.split(",")
            if property_type_value.strip()
        )

    if property_types:
        requested_property_types.extend(
            property_type_value.strip()
            for property_type_value in property_types.split(",")
            if property_type_value.strip()
        )

    valid_property_types = {"studio", "apartment", "room", "house", "parking", "unknown"}
    requested_property_types = [
        property_type_value
        for property_type_value in dict.fromkeys(requested_property_types)
        if property_type_value in valid_property_types
    ]

    requested_cities: list[str] = []
    if cities:
        requested_cities.extend(
            entry.strip() for entry in cities.split(",") if entry.strip()
        )
    if city:
        requested_cities.append(city)

    requested_cities = list(dict.fromkeys(requested_cities))

    if requested_cities:
        if len(requested_cities) == 1:
            query = query.filter(Listing.city.ilike(f"%{requested_cities[0]}%"))
        else:
            query = query.filter(
                or_(*[Listing.city.ilike(f"%{name}%") for name in requested_cities])
            )

    requested_source_filters: list[str] = []
    if sources:
        requested_source_filters.extend(
            entry.strip() for entry in sources.split(",") if entry.strip()
        )
    if source:
        requested_source_filters.append(source)
    requested_source_filters = list(dict.fromkeys(requested_source_filters))

    if requested_source_filters:
        if len(requested_source_filters) == 1:
            single = requested_source_filters[0]
            query = query.filter(
                or_(
                    Listing.source.ilike(f"%{single}%"),
                    Listing.source_key.ilike(f"%{single}%"),
                )
            )
        else:
            query = query.filter(
                or_(
                    *[
                        or_(
                            Listing.source.ilike(f"%{value}%"),
                            Listing.source_key.ilike(f"%{value}%"),
                        )
                        for value in requested_source_filters
                    ]
                )
            )

    if exclude_sources:
        excluded = [
            entry.strip()
            for entry in exclude_sources.split(",")
            if entry.strip()
        ]
        for excluded_value in excluded:
            query = query.filter(
                ~or_(
                    Listing.source.ilike(f"%{excluded_value}%"),
                    Listing.source_key.ilike(f"%{excluded_value}%"),
                )
            )

    price_filters = []

    if min_price is not None:
        price_filters.append(Listing.price >= min_price)

    if max_price is not None and not no_max_price:
        price_filters.append(Listing.price <= max_price)

    if price_filters:
        if include_unknown_price:
            query = query.filter(or_(Listing.price.is_(None), and_(*price_filters)))
        else:
            query = query.filter(Listing.price.is_not(None), *price_filters)
    elif not include_unknown_price:
        query = query.filter(Listing.price.is_not(None))

    if min_area_m2 is not None:
        query = query.filter(Listing.area_m2 >= min_area_m2)

    if max_area_m2 is not None:
        query = query.filter(Listing.area_m2 <= max_area_m2)

    if min_rooms is not None:
        query = query.filter(Listing.rooms >= min_rooms)

    if requested_property_types:
        query = query.filter(Listing.property_type.in_(requested_property_types))
    elif property_type:
        query = query.filter(Listing.property_type == property_type)

    # Types for which private kitchen/bathroom/toilet are assumed when data is absent.
    _PRIVATE_ASSUMPTION_TYPES = ("apartment", "house", "studio")

    if private_kitchen is not None:
        if private_kitchen is True:
            # Include explicit True AND unknown-for-self-contained-type listings that
            # aren't flagged as shared housing.
            query = query.filter(
                or_(
                    Listing.private_kitchen.is_(True),
                    and_(
                        Listing.private_kitchen.is_(None),
                        Listing.property_type.in_(_PRIVATE_ASSUMPTION_TYPES),
                        or_(Listing.is_shared.is_(False), Listing.is_shared.is_(None)),
                    ),
                )
            )
        else:
            query = query.filter(Listing.private_kitchen.is_(False))

    if private_bathroom is not None:
        if private_bathroom is True:
            query = query.filter(
                or_(
                    Listing.private_bathroom.is_(True),
                    and_(
                        Listing.private_bathroom.is_(None),
                        Listing.property_type.in_(_PRIVATE_ASSUMPTION_TYPES),
                        or_(Listing.is_shared.is_(False), Listing.is_shared.is_(None)),
                    ),
                )
            )
        else:
            query = query.filter(Listing.private_bathroom.is_(False))

    if private_toilet is not None:
        if private_toilet is True:
            query = query.filter(
                or_(
                    Listing.private_toilet.is_(True),
                    and_(
                        Listing.private_toilet.is_(None),
                        Listing.property_type.in_(_PRIVATE_ASSUMPTION_TYPES),
                        or_(Listing.is_shared.is_(False), Listing.is_shared.is_(None)),
                    ),
                )
            )
        else:
            query = query.filter(Listing.private_toilet.is_(False))

    if allow_shared is False:
        query = query.filter(or_(Listing.is_shared.is_(False), Listing.is_shared.is_(None)))

    if allow_shared_laundry is False:
        query = query.filter(
            or_(Listing.shared_laundry.is_(False), Listing.shared_laundry.is_(None))
        )

    if has_image is True:
        query = query.filter(Listing.image_url.is_not(None), Listing.image_url != "")
    elif has_image is False:
        query = query.filter(or_(Listing.image_url.is_(None), Listing.image_url == ""))

    if seen_recently_days is not None:
        now = datetime.utcnow()
        since = (
            now.replace(hour=0, minute=0, second=0, microsecond=0)
            if seen_recently_days == 0
            else now - timedelta(days=seen_recently_days)
        )
        query = query.filter(Listing.last_seen_at >= since)

    if min_confidence_score is not None:
        query = query.filter(Listing.confidence_score >= min_confidence_score)

    if exclude_woningruil:
        query = query.filter(or_(Listing.is_woningruil.is_(False), Listing.is_woningruil.is_(None)))

    if exclude_parking:
        query = query.filter(Listing.property_type != "parking")

    if available_now:
        query = query.filter(Listing.availability_status == "available")
    elif hide_rented:
        query = query.filter(
            or_(
                Listing.availability_status.is_(None),
                Listing.availability_status == "unknown",
                Listing.availability_status == "available",
            )
        )

    if only_independent:
        query = query.filter(
            Listing.is_shared.is_(False),
            or_(Listing.private_kitchen.is_(True), Listing.private_kitchen.is_(None)),
            or_(Listing.private_bathroom.is_(True), Listing.private_bathroom.is_(None)),
            Listing.property_type.in_(["studio", "apartment", "house", "unknown"]),
        )

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Listing.title.ilike(search_pattern),
                Listing.description.ilike(search_pattern),
            )
        )

    has_no_image = case((Listing.image_url.is_(None), 1), (Listing.image_url == "", 1), else_=0)

    if sort == "cheapest":
        query = query.order_by(
            case((Listing.price.is_(None), 1), else_=0),
            Listing.price.asc(),
            has_no_image,
            Listing.last_seen_at.desc(),
            Listing.created_at.desc(),
        )
    elif sort == "most_expensive":
        query = query.order_by(
            case((Listing.price.is_(None), 1), else_=0),
            Listing.price.desc(),
            has_no_image,
            Listing.last_seen_at.desc(),
            Listing.created_at.desc(),
        )
    elif sort == "recently_updated":
        query = query.order_by(has_no_image, Listing.last_checked_at.desc(), Listing.updated_at.desc())
    elif sort == "newest":
        query = query.order_by(has_no_image, Listing.first_seen_at.desc(), Listing.created_at.desc())
    elif sort == "best_quality":
        query = query.order_by(
            case((Listing.confidence_score.is_(None), 1), else_=0),
            Listing.confidence_score.desc(),
            has_no_image,
            Listing.last_seen_at.desc(),
            Listing.created_at.desc(),
        )
    else:
        location_rank = case(
            (Listing.location_precision == "exact_address", 0),
            (Listing.location_precision == "street", 1),
            (Listing.location_precision == "postcode", 2),
            (Listing.location_precision == "city", 3),
            else_=4,
        )
        selected_property_rank = (
            case((Listing.property_type.in_(requested_property_types), 0), else_=1)
            if requested_property_types
            else case((Listing.property_type != "unknown", 0), else_=1)
        )
        availability_rank = case(
            (Listing.availability_status == "available", 0),
            (or_(Listing.availability_status.is_(None), Listing.availability_status == "unknown"), 1),
            else_=2,
        )
        preference_ranks = []

        if private_kitchen is True:
            preference_ranks.append(case((Listing.private_kitchen.is_(True), 0), else_=1))

        if private_bathroom is True:
            preference_ranks.append(case((Listing.private_bathroom.is_(True), 0), else_=1))

        if private_toilet is True:
            preference_ranks.append(case((Listing.private_toilet.is_(True), 0), else_=1))

        if allow_shared is False or only_independent:
            preference_ranks.append(
                case((Listing.is_shared.is_(False), 0), (Listing.is_shared.is_(None), 1), else_=2)
            )

        query = query.order_by(
            case((Listing.is_active.is_(True), 0), else_=1),
            availability_rank,
            case((Listing.is_woningruil.is_(True), 1), else_=0),
            case((Listing.property_type == "parking", 1), else_=0),
            location_rank,
            case((Listing.confidence_score.is_(None), 1), else_=0),
            Listing.confidence_score.desc(),
            case((Listing.image_url.is_(None), 1), (Listing.image_url == "", 1), else_=0),
            selected_property_rank,
            *preference_ranks,
            case((Listing.price.is_(None), 1), else_=0),
            case(
                (Listing.property_type.in_(["studio", "apartment", "house"]), 0),
                (Listing.property_type == "room", 1),
                (Listing.property_type == "unknown", 2),
                else_=3,
            ),
            Listing.last_seen_at.desc(),
            Listing.created_at.desc(),
        )

    radius_active = (
        location_lat is not None
        and location_lng is not None
        and radius_km is not None
        and radius_km > 0
    )

    if radius_active:
        lat_margin = radius_km / 111.0
        lng_margin = radius_km / (111.0 * math.cos(math.radians(location_lat)))
        query = query.filter(
            Listing.latitude.isnot(None),
            Listing.longitude.isnot(None),
            Listing.latitude.between(location_lat - lat_margin, location_lat + lat_margin),
            Listing.longitude.between(location_lng - lng_margin, location_lng + lng_margin),
        )
        candidates = query.limit(_RADIUS_MAX_CANDIDATES).all()
        all_in_radius = [
            l for l in candidates
            if _haversine_km(location_lat, location_lng, l.latitude, l.longitude) <= radius_km
        ]
        total = len(all_in_radius)
        user_is_pro = current_user is not None and is_pro(current_user)
        free_limit_applied = not user_is_pro
        if sort == "best_match":
            diversity_pool = all_in_radius[:max(FREE_LISTING_LIMIT, BEST_MATCH_DIVERSITY_WINDOW)]
            diversified = _diversify_best_match_listings(diversity_pool)
            raw_listings = diversified[:FREE_LISTING_LIMIT] if free_limit_applied else diversified[offset: offset + limit]
        elif free_limit_applied:
            raw_listings = all_in_radius[:FREE_LISTING_LIMIT]
        else:
            raw_listings = all_in_radius[offset: offset + limit]
    else:
        total = query.count()
        user_is_pro = current_user is not None and is_pro(current_user)
        free_limit_applied = not user_is_pro

        if sort == "best_match":
            if free_limit_applied:
                candidate_limit = max(FREE_LISTING_LIMIT, min(BEST_MATCH_DIVERSITY_WINDOW, total))
                raw_listings = _diversify_best_match_listings(
                    query.offset(0).limit(candidate_limit).all()
                )[:FREE_LISTING_LIMIT]
            else:
                candidate_limit = min(max(offset + limit, BEST_MATCH_DIVERSITY_WINDOW), total)
                raw_listings = _diversify_best_match_listings(
                    query.offset(0).limit(candidate_limit).all()
                )[offset: offset + limit]
        elif free_limit_applied:
            raw_listings = query.offset(0).limit(FREE_LISTING_LIMIT).all()
        else:
            raw_listings = query.offset(offset).limit(limit).all()

    if free_limit_applied:
        response_items = [
            ListingPreviewResponse(
                id=preview_listing.id,
                city=preview_listing.city,
                price=preview_listing.price,
                property_type=preview_listing.property_type,
                availability_status=preview_listing.availability_status,
                image_url=preview_listing.image_url,
            )
            for preview_listing in (_make_preview_listing(listing) for listing in raw_listings)
        ]
    else:
        duplicate_sources_by_group = duplicate_sources_for_listings(database, raw_listings)
        for listing in raw_listings:
            listing.duplicate_sources = duplicate_sources_by_group.get(
                listing.duplicate_group_id or "",
                [],
            )
            if listing.duplicate_sources:
                listing.source_count = max(listing.source_count or 1, len({
                    src["source"] for src in listing.duplicate_sources
                }))
        response_items = raw_listings

    return ListingsPageResponse(
        items=response_items,
        total=total,
        visible_count=len(response_items),
        free_limit_applied=free_limit_applied,
        requires_pro=free_limit_applied and total > FREE_LISTING_LIMIT,
        preview_fields_only=free_limit_applied,
    )


@router.get("/sitemap", response_model=list[ListingSitemapItem])
def get_listings_sitemap(database: Session = Depends(get_database_session)):
    """Public endpoint for sitemap generation. Returns minimal listing metadata only."""
    from sqlalchemy import or_
    listings = (
        database.query(Listing)
        .filter(
            Listing.is_active.is_(True),
            or_(
                Listing.availability_status.is_(None),
                Listing.availability_status == "unknown",
                Listing.availability_status == "available",
                Listing.availability_status == "under_option",
                Listing.availability_status == "reserved",
            ),
        )
        .order_by(Listing.updated_at.desc())
        .limit(5000)
        .all()
    )
    return [
        ListingSitemapItem(
            id=l.id,
            city=l.city,
            property_type=l.property_type,
            updated_at=l.updated_at or l.created_at or datetime.utcnow(),
        )
        for l in listings
    ]


@router.get("/{listing_id}", response_model=ListingResponse | ListingPreviewResponse)
def get_listing_by_id(
    listing_id: int,
    current_user: User | None = Depends(get_optional_user),
    database: Session = Depends(get_database_session),
):
    listing = database.query(Listing).filter(Listing.id == listing_id).first()

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if current_user is None or not is_pro(current_user):
        preview_listing = _make_preview_listing(listing)
        return ListingPreviewResponse(
            id=preview_listing.id,
            city=preview_listing.city,
            price=preview_listing.price,
            property_type=preview_listing.property_type,
            availability_status=preview_listing.availability_status,
            image_url=preview_listing.image_url,
        )

    return listing


@router.post("/", response_model=ListingResponse, dependencies=[Depends(require_admin)])
def create_listing(
    listing_data: ListingCreate,
    database: Session = Depends(get_database_session),
):
    existing_listing = database.query(Listing).filter(
        Listing.url == listing_data.url
    ).first()

    if existing_listing:
        return existing_listing

    listing = Listing(**listing_data.model_dump())

    database.add(listing)
    database.commit()
    database.refresh(listing)

    return listing
