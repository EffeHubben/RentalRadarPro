import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.db import get_database_session
from app.models.listing import Listing


router = APIRouter(
    prefix="/api/debug",
    tags=["Debug"],
)


def debug_enabled() -> bool:
    return os.getenv("ENVIRONMENT", "development").lower() != "production"


@router.get("/listing-quality")
def listing_quality_summary(database: Session = Depends(get_database_session)):
    if not debug_enabled():
        raise HTTPException(status_code=404, detail="Not found")

    total = database.query(func.count(Listing.id)).scalar() or 0
    low_confidence = (
        database.query(func.count(Listing.id))
        .filter(Listing.confidence_score < 0.45)
        .scalar()
        or 0
    )
    with_image = (
        database.query(func.count(Listing.id))
        .filter(Listing.image_url.is_not(None), Listing.image_url != "")
        .scalar()
        or 0
    )
    with_duplicate_key = (
        database.query(func.count(Listing.id))
        .filter(Listing.duplicate_key.is_not(None), Listing.duplicate_key != "")
        .scalar()
        or 0
    )

    def grouped_counts(column):
        rows = (
            database.query(column, func.count(Listing.id))
            .group_by(column)
            .order_by(func.count(Listing.id).desc())
            .all()
        )
        return {str(key or "unknown"): count for key, count in rows}

    return {
        "total": total,
        "with_image": with_image,
        "with_duplicate_key": with_duplicate_key,
        "low_confidence": low_confidence,
        "by_source": grouped_counts(Listing.source),
        "by_location_precision": grouped_counts(Listing.location_precision),
        "by_availability_status": grouped_counts(Listing.availability_status),
    }
