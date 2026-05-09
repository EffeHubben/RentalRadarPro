import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.admin import require_admin
from app.database.db import get_database_session
from app.models.analytics import AnalyticsEvent


router = APIRouter(tags=["Analytics"])
logger = logging.getLogger("rentscout.analytics")

VALID_EVENT_TYPES = frozenset({
    "page_view",
    "search_view",
    "listing_view",
    "open_listing_click",
    "signup_started",
    "signup_completed",
    "checkout_started",
    "account_view",
    "search_filter_used",
})


class TrackEventRequest(BaseModel):
    event_type: str = Field(max_length=80)
    anonymous_session_id: str | None = Field(default=None, max_length=64)
    path: str | None = Field(default=None, max_length=500)
    listing_id: int | None = None
    city: str | None = Field(default=None, max_length=100)
    referrer_domain: str | None = Field(default=None, max_length=255)
    metadata: str | None = Field(default=None, max_length=2000)


@router.post("/api/analytics/event")
def track_event(
    payload: TrackEventRequest,
    database: Session = Depends(get_database_session),
):
    if payload.event_type not in VALID_EVENT_TYPES:
        return {"ok": True}

    event = AnalyticsEvent(
        event_type=payload.event_type,
        anonymous_session_id=payload.anonymous_session_id,
        path=payload.path,
        listing_id=payload.listing_id,
        city=payload.city,
        referrer_domain=payload.referrer_domain,
        metadata_json=payload.metadata,
    )
    database.add(event)
    try:
        database.commit()
    except Exception:
        database.rollback()
        logger.exception("analytics_event_store_failed")

    return {"ok": True}


@router.get("/api/admin/analytics/overview", dependencies=[Depends(require_admin)])
def get_analytics_overview(database: Session = Depends(get_database_session)):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    def count_today(event_type: str | None = None) -> int:
        q = database.query(func.count(AnalyticsEvent.id)).filter(
            AnalyticsEvent.created_at >= today_start
        )
        if event_type:
            q = q.filter(AnalyticsEvent.event_type == event_type)
        return q.scalar() or 0

    unique_sessions_today = (
        database.query(func.count(func.distinct(AnalyticsEvent.anonymous_session_id)))
        .filter(
            AnalyticsEvent.created_at >= today_start,
            AnalyticsEvent.anonymous_session_id.isnot(None),
        )
        .scalar()
        or 0
    )

    trend: list[dict] = []
    for i in range(7):
        day_start = today_start - timedelta(days=6 - i)
        day_end = day_start + timedelta(days=1)
        count = (
            database.query(func.count(AnalyticsEvent.id))
            .filter(
                AnalyticsEvent.created_at >= day_start,
                AnalyticsEvent.created_at < day_end,
            )
            .scalar()
            or 0
        )
        trend.append({"date": day_start.strftime("%Y-%m-%d"), "count": count})

    return {
        "today": {
            "page_views": count_today("page_view"),
            "searches": count_today("search_view"),
            "listing_views": count_today("listing_view"),
            "open_clicks": count_today("open_listing_click"),
            "unique_sessions": unique_sessions_today,
            "total_events": count_today(),
        },
        "trend_7d": trend,
    }


@router.get("/api/admin/analytics/recent", dependencies=[Depends(require_admin)])
def get_analytics_recent(
    limit: int = Query(default=50, ge=1, le=200),
    database: Session = Depends(get_database_session),
):
    events = (
        database.query(AnalyticsEvent)
        .order_by(AnalyticsEvent.created_at.desc())
        .limit(limit)
        .all()
    )

    return {
        "items": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "session_prefix": (e.anonymous_session_id[:8] + "…") if e.anonymous_session_id else None,
                "path": e.path,
                "listing_id": e.listing_id,
                "city": e.city,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ]
    }


@router.get("/api/admin/analytics/live", dependencies=[Depends(require_admin)])
def get_analytics_live(database: Session = Depends(get_database_session)):
    five_min_ago = datetime.utcnow() - timedelta(minutes=5)
    active = (
        database.query(func.count(func.distinct(AnalyticsEvent.anonymous_session_id)))
        .filter(
            AnalyticsEvent.created_at >= five_min_ago,
            AnalyticsEvent.anonymous_session_id.isnot(None),
        )
        .scalar()
        or 0
    )
    return {"active_sessions": active}
