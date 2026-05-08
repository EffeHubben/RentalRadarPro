from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text

from app.database.db import Base


class Listing(Base):
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String(255), nullable=False)
    source = Column(String(100), nullable=False)
    source_key = Column(String(80), nullable=True, index=True)
    url = Column(Text, nullable=False, unique=True, index=True)

    city = Column(String(100), nullable=True)
    price = Column(Integer, nullable=True)
    area_m2 = Column(Integer, nullable=True)
    rooms = Column(Integer, nullable=True)

    property_type = Column(String(30), nullable=False, default="unknown")
    private_kitchen = Column(Boolean, nullable=True)
    private_bathroom = Column(Boolean, nullable=True)
    private_toilet = Column(Boolean, nullable=True)
    shared_laundry = Column(Boolean, nullable=True)
    is_shared = Column(Boolean, nullable=True)
    is_woningruil = Column(Boolean, nullable=False, default=False)
    availability_status = Column(String(30), nullable=False, default="unknown")
    is_available = Column(Boolean, nullable=True)
    confidence_score = Column(Float, nullable=True)

    image_url = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    address_text = Column(Text, nullable=True)
    street_name = Column(String(255), nullable=True)
    house_number = Column(String(30), nullable=True)
    postal_code = Column(String(20), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_precision = Column(String(30), nullable=False, default="unknown")
    location_confidence = Column(Float, nullable=False, default=0.0)

    duplicate_key = Column(String(255), nullable=True, index=True)
    canonical_key = Column(String(255), nullable=True, index=True)
    duplicate_group_id = Column(String(255), nullable=True, index=True)
    source_count = Column(Integer, nullable=False, default=1)

    is_active = Column(Boolean, default=True)

    @property
    def property_type_sub(self) -> str | None:
        from app.services.listing_quality import infer_property_subtype, normalize_space
        combined = normalize_space(f"{self.title or ''} {self.description or ''}").lower()
        return infer_property_subtype(combined, self.property_type or "unknown")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    first_seen_at = Column(DateTime, default=datetime.utcnow, index=True)
    last_seen_at = Column(DateTime, default=datetime.utcnow)
    last_checked_at = Column(DateTime, default=datetime.utcnow)
