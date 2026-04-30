from fastapi import APIRouter, Query

from app.sources.registry import RENTAL_SOURCES, source_payload


router = APIRouter(
    prefix="/api/sources",
    tags=["Sources"],
)


@router.get("/")
def get_sources(city: str | None = Query(default=None)):
    return [source_payload(source, city=city) for source in RENTAL_SOURCES]
