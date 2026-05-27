from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from app.database.db import Base


class SourceType(str, Enum):
    SCRAPER_ACTIVE = "scraper_active"
    MANUAL_EXTERNAL = "manual_external"
    FEED = "feed"
    API = "api"
    PARTNER_IMPORT = "partner_import"
    UNSUPPORTED = "unsupported"


class SourceStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    BLOCKED = "blocked"
    NEEDS_REVIEW = "needs_review"
    MANUAL_ONLY = "manual_only"
    UNSUPPORTED = "unsupported"


SCANNABLE_SOURCE_TYPES = {
    SourceType.SCRAPER_ACTIVE.value,
    SourceType.FEED.value,
    SourceType.API.value,
}

SCAN_ENABLED_STATUS = SourceStatus.ACTIVE.value


class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(160), nullable=False)
    slug = Column(String(100), nullable=False, unique=True, index=True)
    base_url = Column(Text, nullable=False)
    country = Column(String(2), nullable=False, default="NL")
    city = Column(String(100), nullable=True, index=True)
    region = Column(String(120), nullable=True, index=True)
    source_type = Column(String(40), nullable=False, default=SourceType.MANUAL_EXTERNAL.value, index=True)
    status = Column(String(40), nullable=False, default=SourceStatus.NEEDS_REVIEW.value, index=True)
    is_enabled = Column(Boolean, nullable=False, default=True, index=True)
    scrape_priority = Column(Integer, nullable=False, default=50)
    requires_login = Column(Boolean, nullable=False, default=False)
    has_anti_bot = Column(Boolean, nullable=False, default=False)
    robots_policy = Column(String(80), nullable=True)
    scan_interval_minutes = Column(Integer, nullable=False, default=60)
    last_checked_at = Column(DateTime, nullable=True)
    last_success_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
