from typing import Literal
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import and_, case, or_
from sqlalchemy.orm import Session

from app.database.db import get_database_session
from app.models.listing import Listing
from app.schemas.listing import ListingCreate, ListingResponse


router = APIRouter(
    prefix="/api/listings",
    tags=["Listings"]
)


@router.get("/", response_model=list[ListingResponse])
def get_listings(
    request: Request,
    city: str | None = Query(default=None),
    source: str | None = Query(default=None),
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
    only_independent: bool = Query(default=False),
    search: str | None = Query(default=None),
    sort: Literal[
        "best_match",
        "newest",
        "cheapest",
        "most_expensive",
        "largest",
        "smallest",
    ] = Query(default="best_match"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
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

    if city:
        query = query.filter(Listing.city.ilike(f"%{city}%"))

    if source:
        query = query.filter(Listing.source.ilike(f"%{source}%"))

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

    if private_kitchen is not None:
        query = query.filter(Listing.private_kitchen.is_(private_kitchen))

    if private_bathroom is not None:
        query = query.filter(Listing.private_bathroom.is_(private_bathroom))

    if private_toilet is not None:
        query = query.filter(Listing.private_toilet.is_(private_toilet))

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

    if hide_rented:
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

    if sort == "cheapest":
        query = query.order_by(
            case((Listing.price.is_(None), 1), else_=0),
            Listing.price.asc(),
            Listing.last_seen_at.desc(),
            Listing.created_at.desc(),
        )
    elif sort == "most_expensive":
        query = query.order_by(
            case((Listing.price.is_(None), 1), else_=0),
            Listing.price.desc(),
            Listing.last_seen_at.desc(),
            Listing.created_at.desc(),
        )
    elif sort == "largest":
        query = query.order_by(
            case((Listing.area_m2.is_(None), 1), else_=0),
            Listing.area_m2.desc(),
            Listing.last_seen_at.desc(),
            Listing.created_at.desc(),
        )
    elif sort == "smallest":
        query = query.order_by(
            case((Listing.area_m2.is_(None), 1), else_=0),
            Listing.area_m2.asc(),
            Listing.last_seen_at.desc(),
            Listing.created_at.desc(),
        )
    elif sort == "newest":
        query = query.order_by(Listing.last_seen_at.desc(), Listing.created_at.desc())
    else:
        query = query.order_by(
            case((Listing.is_active.is_(True), 0), else_=1),
            case((Listing.availability_status.in_(["rented", "under_option"]), 1), else_=0),
            case((Listing.image_url.is_(None), 1), (Listing.image_url == "", 1), else_=0),
            Listing.confidence_score.desc(),
            case(
                (Listing.property_type.in_(["studio", "apartment", "house"]), 0),
                (Listing.property_type == "room", 1),
                (Listing.property_type == "unknown", 2),
                else_=3,
            ),
            Listing.last_seen_at.desc(),
            Listing.created_at.desc(),
        )

    listings = query.offset(offset).limit(limit).all()

    return listings


@router.get("/{listing_id}", response_model=ListingResponse)
def get_listing_by_id(
    listing_id: int,
    database: Session = Depends(get_database_session),
):
    listing = database.query(Listing).filter(Listing.id == listing_id).first()

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    return listing


@router.post("/", response_model=ListingResponse)
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
