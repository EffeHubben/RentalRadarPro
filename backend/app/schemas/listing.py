from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


PropertyType = Literal["studio", "apartment", "room", "house", "parking", "unknown"]
AvailabilityStatus = Literal["available", "under_option", "reserved", "rented", "unknown"]
LocationPrecision = Literal["exact_address", "street", "postcode", "city", "unknown"]
HouseSubType = Literal[
    "terraced_house", "corner_house", "semi_detached_house", "detached_house",
    "family_house", "townhouse", "bungalow", "villa", "other_house",
]
ApartmentSubType = Literal[
    "maisonette", "penthouse", "ground_floor_apartment", "upstairs_apartment",
]


class DuplicateSource(BaseModel):
    id: int
    source: str
    url: str
    title: str


class ListingBase(BaseModel):
    title: str
    source: str
    source_key: str | None = None
    url: str

    city: str | None = None
    price: int | None = None
    area_m2: int | None = None
    rooms: int | None = None

    property_type: PropertyType = "unknown"
    property_type_sub: str | None = None
    private_kitchen: bool | None = None
    private_bathroom: bool | None = None
    private_toilet: bool | None = None
    shared_laundry: bool | None = None
    is_shared: bool | None = None
    is_woningruil: bool = False
    availability_status: AvailabilityStatus = "unknown"
    is_available: bool | None = None
    confidence_score: float | None = None

    image_url: str | None = None
    description: str | None = None
    address_text: str | None = None
    street_name: str | None = None
    house_number: str | None = None
    postal_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    location_precision: LocationPrecision = "unknown"
    location_confidence: float = 0.0
    duplicate_key: str | None = None
    canonical_key: str | None = None
    duplicate_group_id: str | None = None
    source_count: int = 1
    is_active: bool = True


class ListingCreate(ListingBase):
    pass


class ListingResponse(ListingBase):
    id: int
    created_at: datetime
    updated_at: datetime
    first_seen_at: datetime | None = None
    last_seen_at: datetime | None = None
    last_checked_at: datetime | None = None
    duplicate_sources: list[DuplicateSource] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ListingPreviewResponse(BaseModel):
    id: int
    city: str | None = None
    price: int | None = None
    property_type: PropertyType = "unknown"
    availability_status: AvailabilityStatus = "unknown"
    image_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ListingSitemapItem(BaseModel):
    id: int
    city: str | None = None
    property_type: PropertyType = "unknown"
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ListingsPageResponse(BaseModel):
    items: list[ListingResponse | ListingPreviewResponse]
    total: int
    visible_count: int
    free_limit_applied: bool
    requires_pro: bool
    preview_fields_only: bool
