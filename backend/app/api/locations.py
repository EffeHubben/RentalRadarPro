from __future__ import annotations

import logging
import re
import time

import requests
from fastapi import APIRouter, Query
from pydantic import BaseModel


logger = logging.getLogger("rentscout.locations")

router = APIRouter(prefix="/api/locations", tags=["Locations"])

PDOK_SUGGEST_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest"
PDOK_TIMEOUT = 5
PDOK_ROWS = 8
_CACHE_TTL = 300.0

_suggest_cache: dict[str, tuple[float, list[dict]]] = {}


class LocationSuggestion(BaseModel):
    label: str
    city: str | None = None
    province: str | None = None
    lat: float
    lng: float


def _parse_centroide(centroide_ll: str) -> tuple[float, float] | None:
    match = re.match(r"POINT\(([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\)", centroide_ll)
    if not match:
        return None
    lng = float(match.group(1))
    lat = float(match.group(2))
    return lat, lng


def _fetch_pdok(q: str) -> list[dict]:
    try:
        resp = requests.get(
            PDOK_SUGGEST_URL,
            params={
                "q": q,
                "rows": PDOK_ROWS,
                "fq": "type:woonplaats OR type:gemeente",
                "fl": "weergavenaam,woonplaatsnaam,gemeentenaam,provincienaam,centroide_ll",
            },
            timeout=PDOK_TIMEOUT,
            headers={"User-Agent": "RentScout/1.0"},
        )
        resp.raise_for_status()
        return resp.json().get("response", {}).get("docs", [])
    except Exception as exc:
        logger.warning("pdok_suggest_failed q=%r error=%s", q, exc)
        return []


@router.get("/suggest", response_model=list[LocationSuggestion])
def suggest_locations(q: str = Query(default="", description="Search query (min 2 chars)")):
    q = q.strip()
    if len(q) < 2:
        return []

    cache_key = q.lower()
    cached = _suggest_cache.get(cache_key)
    if cached and (time.monotonic() - cached[0]) < _CACHE_TTL:
        return cached[1]

    docs = _fetch_pdok(q)
    results: list[dict] = []
    seen: set[str] = set()

    for doc in docs:
        raw = doc.get("centroide_ll", "")
        coords = _parse_centroide(raw)
        if not coords:
            continue
        lat, lng = coords

        label = doc.get("weergavenaam", "").strip()
        if not label or label in seen:
            continue
        seen.add(label)

        results.append({
            "label": label,
            "city": doc.get("woonplaatsnaam") or doc.get("gemeentenaam"),
            "province": doc.get("provincienaam"),
            "lat": lat,
            "lng": lng,
        })

    _suggest_cache[cache_key] = (time.monotonic(), results)
    return results
