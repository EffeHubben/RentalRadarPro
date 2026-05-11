"""Klik voor Wonen scraper.

Uses the public Zig365 Aanbod API behind klikvoorwonen-aanbodapi.zig365.nl.
No authentication is required — the API is publicly accessible and returns all
current listings for the West-Brabant region.

Pagination uses query params: ?page=N&limit=N (0-indexed pages).
City filtering is done client-side since the API ignores filter params for
anonymous (unauthenticated) requests.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.scrapers.base import ScrapedListing

SOURCE_NAME = "Klik voor Wonen"
API_URL = "https://klikvoorwonen-aanbodapi.zig365.nl/api/v1/actueel-aanbod"
DETAIL_URL = "https://www.klikvoorwonen.nl/aanbod/nu-te-huur/huurwoningen/details?dwellingID={url_key}"
IMAGE_BASE_URL = "https://www.klikvoorwonen.nl"
PAGE_SIZE = 10
MAX_PAGES = 40
REQUEST_TIMEOUT_SECONDS = 15

logger = logging.getLogger("rentscout.scrapers.klikvoorwonen")

_HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://www.klikvoorwonen.nl",
    "Referer": "https://www.klikvoorwonen.nl/aanbod/nu-te-huur/huurwoningen",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
}


def _normalize(text: str) -> str:
    return " ".join((text or "").lower().split())


def _city_matches(item: dict[str, Any], requested_city: str) -> bool:
    norm = _normalize(requested_city)
    city_name = _normalize((item.get("city") or {}).get("name", ""))
    muni_name = _normalize((item.get("municipality") or {}).get("name", ""))
    gemeente_name = _normalize(item.get("gemeenteGeoLocatieNaam") or "")
    return norm in (city_name, muni_name, gemeente_name)


def _image_url(item: dict[str, Any]) -> str | None:
    pictures = item.get("pictures") or []
    if not pictures:
        return None
    uri = (pictures[0].get("uri") or "").strip()
    if not uri:
        return None
    return IMAGE_BASE_URL + uri


def _rooms(item: dict[str, Any]) -> int | None:
    sleeping = item.get("sleepingRoom") or {}
    count = sleeping.get("amountOfRooms")
    if count is not None:
        try:
            return int(count) + 1
        except (TypeError, ValueError):
            pass
    return None


def _build_listing(item: dict[str, Any]) -> ScrapedListing | None:
    url_key = item.get("urlKey")
    if not url_key:
        return None

    city_name = (item.get("city") or {}).get("name") or item.get("gemeenteGeoLocatieNaam") or ""

    street = item.get("street") or ""
    house_number = str(item.get("houseNumber") or "").strip()
    addition = str(item.get("houseNumberAddition") or "").strip()
    address = f"{street} {house_number}{addition}".strip()

    dwelling = item.get("dwellingType") or {}
    dwelling_name = dwelling.get("localizedName") or dwelling.get("name") or ""
    description = item.get("infoveldKort") or dwelling_name or ""

    title = f"{address}, {city_name}".strip(", ") or "Klik voor Wonen woning"
    title = title[:140]

    price_raw = item.get("totalRent")
    price = int(round(price_raw)) if isinstance(price_raw, (int, float)) and price_raw > 0 else None

    area_raw = item.get("areaDwelling")
    area_m2: int | None = None
    if area_raw is not None:
        try:
            rounded = int(round(float(area_raw)))
            if 5 <= rounded <= 500:
                area_m2 = rounded
        except (TypeError, ValueError):
            pass

    return ScrapedListing(
        title=title,
        source=SOURCE_NAME,
        url=DETAIL_URL.format(url_key=url_key),
        city=city_name,
        price=price,
        area_m2=area_m2,
        rooms=_rooms(item),
        image_url=_image_url(item),
        description=description,
        availability_status="available",
        is_available=True,
        address_text=address or None,
        street_name=street or None,
        house_number=house_number or None,
        postal_code=item.get("postalcode") or None,
    )


def fetch_klikvoorwonen_listings(city: str = "Breda") -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_ids: set[int] = set()

    with httpx.Client(timeout=REQUEST_TIMEOUT_SECONDS, headers=_HEADERS) as client:
        for page in range(MAX_PAGES):
            try:
                response = client.post(
                    API_URL,
                    params={"page": page, "limit": PAGE_SIZE},
                    json={},
                )
                response.raise_for_status()
                data = response.json()
            except Exception:
                logger.exception("klikvoorwonen_fetch_failed city=%s page=%s", city, page)
                break

            items = data.get("data") or []
            meta = data.get("_metadata") or {}
            total_pages = meta.get("page_count", 0)

            for item in items:
                item_id = item.get("id") or item.get("ID")
                if item_id in seen_ids:
                    continue
                seen_ids.add(item_id)

                if not _city_matches(item, city):
                    continue

                listing = _build_listing(item)
                if listing:
                    listings.append(listing)

            if page >= total_pages - 1:
                break

    logger.info("klikvoorwonen_scrape city=%s listings_found=%s", city, len(listings))
    return listings
