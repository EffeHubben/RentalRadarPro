import logging
import time
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.admin import require_admin
from app.core.config import settings
from app.database.db import get_database_session
from app.models.monitoring import UptimeCheck
from app.models.scan_history import ScanHistory


router = APIRouter(tags=["Monitoring"])
logger = logging.getLogger("rentscout.monitoring")

UPTIME_HISTORY_LIMIT = 20
SCANNER_FAILURE_LIMIT = 5


def _check_database(database: Session) -> dict:
    start = time.monotonic()
    try:
        database.execute(text("SELECT 1"))
        return {"status": "ok", "latency_ms": int((time.monotonic() - start) * 1000)}
    except Exception as exc:
        return {"status": "error", "latency_ms": None, "error": str(exc)[:200]}


def _scanner_status(database: Session) -> dict:
    recent = database.query(ScanHistory).order_by(ScanHistory.finished_at.desc()).first()

    if not recent:
        return {"status": "never_run", "last_run_at": None, "last_status": None, "age_minutes": None}

    age_minutes = None
    if recent.finished_at:
        age_minutes = int((datetime.utcnow() - recent.finished_at).total_seconds() / 60)

    return {
        "status": recent.status,
        "last_run_at": recent.finished_at.isoformat() if recent.finished_at else None,
        "last_status": recent.status,
        "age_minutes": age_minutes,
        "city": recent.city,
        "source_id": recent.source_id,
    }


def _recent_failures(database: Session) -> list:
    failures = (
        database.query(ScanHistory)
        .filter(ScanHistory.status.in_(["failed", "blocked"]))
        .order_by(ScanHistory.finished_at.desc())
        .limit(SCANNER_FAILURE_LIMIT)
        .all()
    )
    return [
        {
            "city": f.city,
            "source_id": f.source_id,
            "status": f.status,
            "error": f.error[:200] if f.error else None,
            "finished_at": f.finished_at.isoformat() if f.finished_at else None,
        }
        for f in failures
    ]


@router.get("/api/admin/health", dependencies=[Depends(require_admin)])
def get_admin_health(database: Session = Depends(get_database_session)):
    db_status = _check_database(database)
    scanner_status = _scanner_status(database)
    scanner_failures = _recent_failures(database)

    recent_checks = (
        database.query(UptimeCheck)
        .order_by(UptimeCheck.checked_at.desc())
        .limit(UPTIME_HISTORY_LIMIT)
        .all()
    )

    check = UptimeCheck(
        service="database",
        status=db_status["status"],
        checked_at=datetime.utcnow(),
        latency_ms=db_status.get("latency_ms"),
        error=db_status.get("error"),
    )
    database.add(check)
    try:
        database.commit()
    except Exception:
        database.rollback()
        logger.exception("uptime_check_record_failed")

    return {
        "database": db_status,
        "scanner": scanner_status,
        "scanner_recent_failures": scanner_failures,
        "config": {
            "email_configured": bool(settings.resend_api_key and settings.email_from),
            "stripe_configured": bool(settings.stripe_secret_key and settings.stripe_price_id_pro),
            "email_verification_enabled": settings.email_verification_enabled,
        },
        "uptime_history": [
            {
                "service": c.service,
                "status": c.status,
                "checked_at": c.checked_at.isoformat(),
                "latency_ms": c.latency_ms,
                "error": c.error,
            }
            for c in recent_checks
        ],
        "checked_at": datetime.utcnow().isoformat(),
    }
