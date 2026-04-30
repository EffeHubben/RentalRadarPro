from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


PropertyType = Literal["studio", "apartment", "room", "house", "parking", "unknown"]
AvailabilityStatus = Literal["available", "under_option", "rented", "unknown"]
LocationPrecision = Literal["exact_address", "street", "postcode", "city", "unknown"]


class ListingBase(BaseModel):
    title: str
    source: str
    url: str

    city: str | None = None
    price: int | None = None
    area_m2: int | None = None
    rooms: int | None = None

    property_type: PropertyType = "unknown"
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
    is_active: bool = True


class ListingCreate(ListingBase):
    pass


class ListingResponse(ListingBase):
    id: int
    created_at: datetime
    updated_at: datetime
    last_seen_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
