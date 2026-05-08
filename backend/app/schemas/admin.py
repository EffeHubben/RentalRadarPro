from datetime import datetime

from pydantic import BaseModel


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
    items: list[AdminUserResponse]


class AdminEmailDeliveryResponse(BaseModel):
    id: int
    user_id: int | None
    email_type: str
    provider_message_id: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminEmailDeliveriesListResponse(BaseModel):
    items: list[AdminEmailDeliveryResponse]
    table_available: bool
