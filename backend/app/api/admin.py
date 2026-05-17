from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, inspect, or_
from sqlalchemy.orm import Session

from app.api.sources import build_sources_payloads
from app.core.admin import require_admin
from app.database.db import engine, get_database_session
from app.models.email_delivery import EmailDelivery
from app.models.listing import Listing
from app.models.scan_history import ScanHistory
from app.models.user import User
from app.services.listing_verifier import verify_stale_listings
from app.sources.registry import RENTAL_SOURCES
from app.schemas.admin import (
    AdminEmailDeliveriesListResponse,
    AdminEmailDeliveryResponse,
    AdminOverviewResponse,
    AdminScanEntryResponse,
    AdminScanHealthResponse,
    AdminScansListResponse,
    AdminSetUserAdminRequest,
    AdminSetUserPlanRequest,
    AdminSourceHealthEntry,
    AdminUserResponse,
    AdminUsersListResponse,
)


router = APIRouter(prefix="/api/admin", tags=["Admin"])

PRO_SUBSCRIPTION_STATUSES = {"active", "trialing"}
RECENT_ACTIVITY_WINDOW_DAYS = 7
USER_SEGMENTS = {"all", "free", "pro", "admin", "inactive", "past_due", "canceled"}
EMAIL_DELIVERY_STATUSES = {"all", "sent", "failed"}
SCAN_SUCCESS_STATUSES = {"success", "duplicate_only"}
SCAN_NO_RESULT_STATUSES = {"no_results", "source_returned_empty", "all_results_filtered_out"}
SCAN_BLOCKED_STATUSES = {"blocked", "blocked_or_forbidden"}
SCAN_FAILED_STATUSES = {"failed", "timeout", "invalid_response", "parse_error", "geocoding_failed"}


def email_deliveries_table_exists() -> bool:
    inspector = inspect(engine)
    return "email_deliveries" in inspector.get_table_names()


def serialize_admin_user(user: User) -> AdminUserResponse:
    return AdminUserResponse(
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


def get_target_user(database: Session, user_id: int) -> User:
    user = database.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


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

    total_sources = len(RENTAL_SOURCES)
    online_sources = sum(1 for s in RENTAL_SOURCES if s.status == "online")

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
        total_sources=total_sources,
        online_sources=online_sources,
    )


@router.get("/users", response_model=AdminUsersListResponse)
def get_admin_users(
    search: str | None = Query(default=None, min_length=1, max_length=120),
    segment: Literal["all", "free", "pro", "admin", "inactive", "past_due", "canceled"] = Query(default="all"),
    limit: int = Query(default=50, ge=1, le=200),
    admin_user: User = Depends(require_admin),
    database: Session = Depends(get_database_session),
):
    del admin_user

    if segment not in USER_SEGMENTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user segment")

    query = database.query(User)

    if search:
        trimmed_search = search.strip()
        like_query = f"%{trimmed_search}%"
        query = query.filter(
            or_(
                User.email.ilike(like_query),
                User.display_name.ilike(like_query),
            )
        )

    if segment == "free":
        query = query.filter(User.plan == "free")
    elif segment == "pro":
        query = query.filter(User.plan == "pro")
    elif segment == "admin":
        query = query.filter(User.is_admin.is_(True))
    elif segment in {"inactive", "past_due", "canceled"}:
        query = query.filter(User.subscription_status == segment)

    total = query.count()
    users = query.order_by(User.created_at.desc(), User.id.desc()).limit(limit).all()

    return AdminUsersListResponse(total=int(total), items=[serialize_admin_user(user) for user in users])


@router.patch("/users/{user_id}/admin", response_model=AdminUserResponse)
def update_admin_user_admin_status(
    payload: AdminSetUserAdminRequest,
    user_id: int = Path(..., ge=1),
    admin_user: User = Depends(require_admin),
    database: Session = Depends(get_database_session),
):
    target_user = get_target_user(database, user_id)

    if admin_user.id == target_user.id and not payload.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove your own admin access",
        )

    target_user.is_admin = payload.is_admin
    database.commit()
    database.refresh(target_user)
    return serialize_admin_user(target_user)


@router.patch("/users/{user_id}/plan", response_model=AdminUserResponse)
def update_admin_user_plan(
    payload: AdminSetUserPlanRequest,
    user_id: int = Path(..., ge=1),
    admin_user: User = Depends(require_admin),
    database: Session = Depends(get_database_session),
):
    del admin_user
    target_user = get_target_user(database, user_id)

    if payload.plan == "free":
        target_user.plan = "free"
        target_user.subscription_status = "inactive"
        target_user.subscription_current_period_end = None
        target_user.subscription_cancel_at_period_end = False
    else:
        target_user.plan = "pro"
        target_user.subscription_status = "active"
        target_user.subscription_current_period_end = payload.expires_at
        target_user.subscription_cancel_at_period_end = False

    database.commit()
    database.refresh(target_user)
    return serialize_admin_user(target_user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_user(
    user_id: int = Path(..., ge=1),
    admin_user: User = Depends(require_admin),
    database: Session = Depends(get_database_session),
):
    target_user = get_target_user(database, user_id)

    if admin_user.id == target_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own admin account",
        )

    database.delete(target_user)
    database.commit()
    return


@router.post("/listings/verify-stale")
def trigger_verify_stale_listings(
    batch_size: int = Query(default=20, ge=1, le=100),
    max_age_hours: int = Query(default=12, ge=1, le=168),
    admin_user: User = Depends(require_admin),
    database: Session = Depends(get_database_session),
):
    del admin_user
    return verify_stale_listings(database, batch_size=batch_size, max_age_hours=max_age_hours)


@router.get("/email-deliveries", response_model=AdminEmailDeliveriesListResponse)
def get_admin_email_deliveries(
    status_filter: Literal["all", "sent", "failed"] = Query(default="all", alias="status"),
    email_type: str | None = Query(default=None, min_length=1, max_length=80),
    limit: int = Query(default=50, ge=1, le=200),
    admin_user: User = Depends(require_admin),
    database: Session = Depends(get_database_session),
):
    del admin_user

    if not email_deliveries_table_exists():
        return AdminEmailDeliveriesListResponse(
            items=[],
            table_available=False,
            status_tracking_limited=True,
            available_email_types=[],
        )

    if status_filter not in EMAIL_DELIVERY_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid delivery status filter")

    available_email_types = [
        row[0]
        for row in database.query(EmailDelivery.email_type)
        .distinct()
        .order_by(EmailDelivery.email_type.asc())
        .all()
        if row[0]
    ]

    if status_filter == "failed":
        return AdminEmailDeliveriesListResponse(
            items=[],
            table_available=True,
            status_tracking_limited=True,
            available_email_types=available_email_types,
        )

    query = database.query(EmailDelivery)
    if email_type:
        query = query.filter(EmailDelivery.email_type == email_type.strip())

    deliveries = query.order_by(EmailDelivery.created_at.desc(), EmailDelivery.id.desc()).limit(limit).all()
    items = [
        AdminEmailDeliveryResponse(
            id=delivery.id,
            user_id=delivery.user_id,
            email_type=delivery.email_type,
            delivery_status="sent",
            provider_message_id=delivery.provider_message_id,
            created_at=delivery.created_at,
        )
        for delivery in deliveries
    ]
    return AdminEmailDeliveriesListResponse(
        items=items,
        table_available=True,
        status_tracking_limited=True,
        available_email_types=available_email_types,
    )


@router.get("/sources")
def get_admin_sources(
    city: str | None = Query(default=None),
    admin_user: User = Depends(require_admin),
    database: Session = Depends(get_database_session),
):
    del admin_user
    return build_sources_payloads(database, city=city)


@router.get("/coverage")
def get_admin_coverage(
    admin_user: User = Depends(require_admin),
    database: Session = Depends(get_database_session),
):
    """Return listing volume per city and per source plus failed source/city combos."""
    del admin_user

    listings_by_city = [
        {"city": city or "(unknown)", "count": int(count)}
        for city, count in (
            database.query(Listing.city, func.count(Listing.id))
            .filter(Listing.is_active.is_(True))
            .group_by(Listing.city)
            .order_by(func.count(Listing.id).desc())
            .all()
        )
    ]
    listings_by_source = [
        {"source": source or "(unknown)", "count": int(count)}
        for source, count in (
            database.query(Listing.source, func.count(Listing.id))
            .filter(Listing.is_active.is_(True))
            .group_by(Listing.source)
            .order_by(func.count(Listing.id).desc())
            .all()
        )
    ]

    from app.models.scan_history import ScanHistory  # local import to avoid cycle

    failed_combos_query = (
        database.query(
            ScanHistory.source_id,
            ScanHistory.city,
            ScanHistory.status,
            func.count(ScanHistory.id),
            func.max(ScanHistory.finished_at),
        )
        .filter(ScanHistory.status.in_(SCAN_FAILED_STATUSES | SCAN_BLOCKED_STATUSES))
        .group_by(ScanHistory.source_id, ScanHistory.city, ScanHistory.status)
        .order_by(func.max(ScanHistory.finished_at).desc())
        .limit(60)
        .all()
    )
    failed_combos = [
        {
            "source_id": source_id,
            "city": city,
            "status": status_value,
            "count": int(count),
            "last_finished_at": finished_at.isoformat() if finished_at else None,
        }
        for source_id, city, status_value, count, finished_at in failed_combos_query
    ]

    return {
        "listings_by_city": listings_by_city,
        "listings_by_source": listings_by_source,
        "failed_source_city_combos": failed_combos,
    }


@router.get("/scans", response_model=AdminScansListResponse)
def get_admin_recent_scans(
    limit: int = Query(default=50, ge=1, le=200),
    hours: int = Query(default=24, ge=1, le=168),
    source_id: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    admin_user: User = Depends(require_admin),
    database: Session = Depends(get_database_session),
):
    del admin_user
    since = datetime.utcnow() - timedelta(hours=hours)
    query = database.query(ScanHistory).filter(ScanHistory.started_at >= since)
    if source_id:
        query = query.filter(ScanHistory.source_id == source_id)
    if status_filter:
        query = query.filter(ScanHistory.status == status_filter)
    total = query.count()
    items = (
        query.order_by(ScanHistory.finished_at.desc().nullslast(), ScanHistory.started_at.desc())
        .limit(limit)
        .all()
    )
    return AdminScansListResponse(
        items=[
            AdminScanEntryResponse(
                id=entry.id,
                source_id=entry.source_id,
                city=entry.city,
                status=entry.status,
                scraped_count=entry.scraped_count or 0,
                created_count=entry.created_count or 0,
                updated_count=entry.updated_count or 0,
                duplicate_count=entry.duplicate_count or 0,
                duration_ms=entry.duration_ms,
                error=(entry.error[:240] if entry.error else None),
                started_at=entry.started_at,
                finished_at=entry.finished_at,
            )
            for entry in items
        ],
        total=total,
        window_hours=hours,
    )


@router.get("/scan-health", response_model=AdminScanHealthResponse)
def get_admin_scan_health(
    hours: int = Query(default=24, ge=1, le=168),
    admin_user: User = Depends(require_admin),
    database: Session = Depends(get_database_session),
):
    """Aggregated per-source scan health for the last N hours."""
    del admin_user
    now = datetime.utcnow()
    since = now - timedelta(hours=hours)

    aggregates = (
        database.query(
            ScanHistory.source_id,
            ScanHistory.status,
            func.count(ScanHistory.id),
            func.sum(ScanHistory.created_count),
        )
        .filter(ScanHistory.started_at >= since)
        .group_by(ScanHistory.source_id, ScanHistory.status)
        .all()
    )

    per_source: dict[str, dict] = {}
    for source_id, status_value, count, created_sum in aggregates:
        bucket = per_source.setdefault(
            source_id,
            {
                "scans_total": 0,
                "scans_success": 0,
                "scans_failed": 0,
                "scans_blocked": 0,
                "scans_no_results": 0,
                "listings_created": 0,
            },
        )
        n = int(count or 0)
        bucket["scans_total"] += n
        bucket["listings_created"] += int(created_sum or 0)
        if status_value in SCAN_SUCCESS_STATUSES:
            bucket["scans_success"] += n
        elif status_value in SCAN_FAILED_STATUSES:
            bucket["scans_failed"] += n
        elif status_value in SCAN_BLOCKED_STATUSES:
            bucket["scans_blocked"] += n
        elif status_value in SCAN_NO_RESULT_STATUSES:
            bucket["scans_no_results"] += n

    payloads = build_sources_payloads(database)
    payload_by_key = {p["source_id"]: p for p in payloads}

    items: list[AdminSourceHealthEntry] = []
    for source in RENTAL_SOURCES:
        bucket = per_source.get(source.source_key, {
            "scans_total": 0,
            "scans_success": 0,
            "scans_failed": 0,
            "scans_blocked": 0,
            "scans_no_results": 0,
            "listings_created": 0,
        })
        total = bucket["scans_total"]
        good = bucket["scans_success"] + bucket["scans_no_results"]
        success_rate = (good / total) if total else 0.0

        payload = payload_by_key.get(source.source_key, {})
        last_run = payload.get("last_run") or {}
        last_status = last_run.get("status")
        last_finished_at = last_run.get("finished_at") or payload.get("last_scan_finished_at")
        if isinstance(last_finished_at, str):
            try:
                last_finished_at = datetime.fromisoformat(last_finished_at.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                last_finished_at = None
        next_due_at = payload.get("next_due_at")
        if isinstance(next_due_at, str):
            try:
                next_due_at = datetime.fromisoformat(next_due_at.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                next_due_at = None

        items.append(AdminSourceHealthEntry(
            source_id=source.source_key,
            display_name=source.display_name,
            auto_scan_enabled=bool(source.auto_scan_enabled),
            scans_total=total,
            scans_success=bucket["scans_success"],
            scans_failed=bucket["scans_failed"],
            scans_blocked=bucket["scans_blocked"],
            scans_no_results=bucket["scans_no_results"],
            success_rate=round(success_rate, 3),
            listings_created=bucket["listings_created"],
            last_status=last_status,
            last_finished_at=last_finished_at if isinstance(last_finished_at, datetime) else None,
            last_error=(last_run.get("error") or payload.get("last_error") or None),
            is_cooling_down=bool(payload.get("is_cooling_down")),
            next_due_at=next_due_at if isinstance(next_due_at, datetime) else None,
        ))

    items.sort(key=lambda i: (
        not i.auto_scan_enabled,
        i.success_rate if i.scans_total else 1.0,
        -i.scans_total,
        i.display_name.lower(),
    ))

    return AdminScanHealthResponse(items=items, window_hours=hours, generated_at=now)
