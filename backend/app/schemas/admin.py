from datetime import datetime, timezone

from pydantic import BaseModel, field_validator
from typing import Literal


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
