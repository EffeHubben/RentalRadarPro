from datetime import datetime, timezone

from pydantic import BaseModel, field_validator
from typing import Literal

from app.models.source import SourceStatus, SourceType


class AdminOverviewResponse(BaseModel):
    total_users: int
    free_users: int
    pro_users: int
    active_subscriptions: int
    canceled_subscriptions: int
    past_due_subscriptions: int
    inactive_subscriptions: int
    total_listings: int
    recent_registrations_count: int
    recent_email_deliveries_count: int
    total_sources: int
    online_sources: int


class AdminUserResponse(BaseModel):
    id: int
    email: str
    display_name: str | None
    plan: str
    subscription_status: str
    subscription_current_period_end: datetime | None
    email_verified: bool
    created_at: datetime
    is_admin: bool

    class Config:
        from_attributes = True


class AdminUsersListResponse(BaseModel):
    total: int
    items: list[AdminUserResponse]


class AdminEmailDeliveryResponse(BaseModel):
    id: int
    user_id: int | None
    email_type: str
    delivery_status: Literal["sent"]
    provider_message_id: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminEmailDeliveriesListResponse(BaseModel):
    items: list[AdminEmailDeliveryResponse]
    table_available: bool
    status_tracking_limited: bool
    available_email_types: list[str]


class AdminSetUserAdminRequest(BaseModel):
    is_admin: bool


class AdminSetUserPlanRequest(BaseModel):
    plan: Literal["free", "pro"]
    expires_at: datetime | None = None

    @field_validator("expires_at")
    @classmethod
    def validate_expires_at(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return value

        now = datetime.now(timezone.utc) if value.tzinfo else datetime.utcnow()
        if value <= now:
            raise ValueError("Expiry date must be in the future")
        return value

    @field_validator("expires_at")
    @classmethod
    def validate_free_plan_expiry(cls, value: datetime | None, info):
        plan = info.data.get("plan")
        if plan == "free" and value is not None:
            raise ValueError("Free plan cannot have an expiry date")
        return value


class AdminScanEntryResponse(BaseModel):
    id: int
    source_id: str
    city: str | None
    status: str
    scraped_count: int
    created_count: int
    updated_count: int
    duplicate_count: int
    duration_ms: int | None
    error: str | None
    started_at: datetime | None
    finished_at: datetime | None

    class Config:
        from_attributes = True


class AdminScansListResponse(BaseModel):
    items: list[AdminScanEntryResponse]
    total: int
    window_hours: int


class AdminSourceHealthEntry(BaseModel):
    source_id: str
    display_name: str
    auto_scan_enabled: bool
    scans_total: int
    scans_success: int
    scans_failed: int
    scans_blocked: int
    scans_no_results: int
    success_rate: float
    listings_created: int
    last_status: str | None
    last_finished_at: datetime | None
    last_error: str | None
    is_cooling_down: bool
    next_due_at: datetime | None


class AdminScanHealthResponse(BaseModel):
    items: list[AdminSourceHealthEntry]
    window_hours: int
    generated_at: datetime


class AdminSourceResponse(BaseModel):
    id: int
    name: str
    slug: str
    base_url: str
    country: str
    city: str | None
    region: str | None
    source_type: Literal[
        "scraper_active",
        "manual_external",
        "feed",
        "api",
        "partner_import",
        "unsupported",
    ]
    status: Literal[
        "active",
        "paused",
        "blocked",
        "needs_review",
        "manual_only",
        "unsupported",
    ]
    is_enabled: bool
    scrape_priority: int
    requires_login: bool
    has_anti_bot: bool
    robots_policy: str | None
    scan_interval_minutes: int
    last_checked_at: datetime | None
    last_success_at: datetime | None
    last_error: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    is_scannable: bool
    scan_skip_reason: str | None

    class Config:
        from_attributes = True


class AdminSourceCreateRequest(BaseModel):
    name: str
    slug: str | None = None
    base_url: str
    country: str = "NL"
    city: str | None = None
    region: str | None = None
    source_type: SourceType = SourceType.MANUAL_EXTERNAL
    status: SourceStatus = SourceStatus.NEEDS_REVIEW
    is_enabled: bool = True
    scrape_priority: int = 50
    requires_login: bool = False
    has_anti_bot: bool = False
    robots_policy: str | None = None
    scan_interval_minutes: int = 60
    notes: str | None = None


class AdminSourceUpdateRequest(BaseModel):
    name: str | None = None
    base_url: str | None = None
    country: str | None = None
    city: str | None = None
    region: str | None = None
    source_type: SourceType | None = None
    status: SourceStatus | None = None
    is_enabled: bool | None = None
    scrape_priority: int | None = None
    requires_login: bool | None = None
    has_anti_bot: bool | None = None
    robots_policy: str | None = None
    scan_interval_minutes: int | None = None
    notes: str | None = None


class AdminSourceEnabledRequest(BaseModel):
    is_enabled: bool


class AdminSourceClassificationRequest(BaseModel):
    source_type: SourceType | None = None
    status: SourceStatus | None = None


class AdminSourceTestScanRequest(BaseModel):
    city: str | None = None
