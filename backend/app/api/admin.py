from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, inspect
from sqlalchemy.orm import Session

from app.api.sources import build_sources_payloads
from app.core.admin import require_admin
from app.database.db import engine, get_database_session
from app.models.email_delivery import EmailDelivery
from app.models.listing import Listing
from app.models.user import User
from app.schemas.admin import (
    AdminEmailDeliveriesListResponse,
    AdminEmailDeliveryResponse,
    AdminOverviewResponse,
    AdminUserResponse,
    AdminUsersListResponse,
)


router = APIRouter(prefix="/api/admin", tags=["Admin"])

PRO_SUBSCRIPTION_STATUSES = {"active", "trialing"}
RECENT_ACTIVITY_WINDOW_DAYS = 7


def email_deliveries_table_exists() -> bool:
    inspector = inspect(engine)
    return "email_deliveries" in inspector.get_table_names()


@router.get("/overview", response_model=AdminOverviewResponse)
def get_admin_overview(
    admin_user: User = Depends(require_admin),
    database: Session = Depends(get_database_session),
):
    del admin_user

    recent_cutoff = datetime.utcnow() - timedelta(days=RECENT_ACTIVITY_WINDOW_DAYS)
    total_users = database.query(func.count(User.id)).scalar() or 0
    free_users = database.query(func.count(User.id)).filter(User.plan == "free").scalar() or 0
    pro_users = database.query(func.count(User.id)).filter(User.plan == "pro").scalar() or 0
    active_subscriptions = (
        database.query(func.count(User.id))
        .filter(User.subscription_status.in_(PRO_SUBSCRIPTION_STATUSES))
        .scalar()
        or 0
    )
    canceled_subscriptions = (
        database.query(func.count(User.id)).filter(User.subscription_status == "canceled").scalar() or 0
    )
    past_due_subscriptions = (
        database.query(func.count(User.id)).filter(User.subscription_status == "past_due").scalar() or 0
    )
    inactive_subscriptions = (
        database.query(func.count(User.id)).filter(User.subscription_status == "inactive").scalar() or 0
    )
    total_listings = database.query(func.count(Listing.id)).scalar() or 0
    recent_registrations_count = (
        database.query(func.count(User.id)).filter(User.created_at >= recent_cutoff).scalar() or 0
    )

    recent_email_deliveries_count = 0
    if email_deliveries_table_exists():
        recent_email_deliveries_count = (
            database.query(func.count(EmailDelivery.id))
            .filter(EmailDelivery.created_at >= recent_cutoff)
            .scalar()
            or 0
        )

    return AdminOverviewResponse(
        total_users=int(total_users),
        free_users=int(free_users),
        pro_users=int(pro_users),
        active_subscriptions=int(active_subscriptions),
        canceled_subscriptions=int(canceled_subscriptions),
        past_due_subscriptions=int(past_due_subscriptions),
        inactive_subscriptions=int(inactive_subscriptions),
        total_listings=int(total_listings),
        recent_registrations_count=int(recent_registrations_count),
        recent_email_deliveries_count=int(recent_email_deliveries_count),
    )


@router.get("/users", response_model=AdminUsersListResponse)
def get_admin_users(
    limit: int = Query(default=50, ge=1, le=200),
    admin_user: User = Depends(require_admin),
    database: Session = Depends(get_database_session),
):
    del admin_user

    users = (
        database.query(User)
        .order_by(User.created_at.desc(), User.id.desc())
        .limit(limit)
        .all()
    )
    items = [
        AdminUserResponse(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            plan=user.plan,
            subscription_status=user.subscription_status,
            subscription_current_period_end=user.subscription_current_period_end,
            email_verified=bool(user.email_verified),
            created_at=user.created_at,
            is_admin=bool(user.is_admin),
        )
        for user in users
    ]
    return AdminUsersListResponse(items=items)


@router.get("/email-deliveries", response_model=AdminEmailDeliveriesListResponse)
def get_admin_email_deliveries(
    limit: int = Query(default=50, ge=1, le=200),
    admin_user: User = Depends(require_admin),
    database: Session = Depends(get_database_session),
):
    del admin_user

    if not email_deliveries_table_exists():
        return AdminEmailDeliveriesListResponse(items=[], table_available=False)

    deliveries = (
        database.query(EmailDelivery)
        .order_by(EmailDelivery.created_at.desc(), EmailDelivery.id.desc())
        .limit(limit)
        .all()
    )
    items = [
        AdminEmailDeliveryResponse(
            id=delivery.id,
            user_id=delivery.user_id,
            email_type=delivery.email_type,
            provider_message_id=delivery.provider_message_id,
            created_at=delivery.created_at,
        )
        for delivery in deliveries
    ]
    return AdminEmailDeliveriesListResponse(items=items, table_available=True)


@router.get("/sources")
def get_admin_sources(
    city: str | None = Query(default=None),
    admin_user: User = Depends(require_admin),
    database: Session = Depends(get_database_session),
):
    del admin_user
    return build_sources_payloads(database, city=city)
