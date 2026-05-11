"""Holland2Stay scraper.

Uses the public Magento 2 GraphQL API behind www.holland2stay.com. The
website is fronted by Cloudflare, so plain `requests` returns 403. We use
`curl_cffi` with a Chrome TLS fingerprint, which is what the site's own
frontend produces - the GraphQL endpoint then accepts our queries.

We only return listings whose `available_to_book` code is 179
("Direct te boeken" / directly bookable). Other states (lottery, coming
soon, reserved) are excluded because they aren't actionable yet.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from curl_cffi import requests as cffi_requests

from app.scrapers.base import (
    ScrapedListing,
    parse_area_m2,
)


SOURCE_NAME = "Holland2Stay"
API_URL = "https://api.holland2stay.com/graphql"
RESIDENCE_DETAIL_URL = "https://www.holland2stay.com/residence/{slug}"
RESIDENCES_CATEGORY_UID = "Nw=="
DIRECTLY_BOOKABLE_CODE = "179"
PAGE_SIZE = 50
MAX_PAGES_PER_CITY = 4
REQUEST_TIMEOUT_SECONDS = 20

logger = logging.getLogger("rentscout.scrapers.holland2stay")

CITY_ID_BY_NAME: dict[str, str] = {
    "amersfoort": "6249",
    "amsterdam": "24",
    "arnhem": "320",
    "capelle aan den ijssel": "619",
    "delft": "26",
    "den bosch": "28",
    "den haag": "90",
    "diemen": "110",
    "dordrecht": "620",
    "eindhoven": "29",
    "groningen": "545",
    "haarlem": "616",
    "helmond": "6099",
    "leiden": "6293",
    "maarssen": "6209",
    "maastricht": "6090",
    "nieuwegein": "6051",
    "nijmegen": "6217",
    "rijswijk": "6224",
    "rotterdam": "25",
    "sittard": "6211",
    "tilburg": "6093",
    "utrecht": "27",
    "velp": "6265",
    "zeist": "6145",
    "zoetermeer": "6088",
}
CITY_NAME_BY_ID: dict[str, str] = {value: name.title() for name, value in CITY_ID_BY_NAME.items()}

RESIDENT_TYPE_BY_ID: dict[str, str] = {
    "15": "studio",
    "16": "apartment",
    "17": "apartment",       # Penthouse
    "18": "apartment",       # Loft
    "6254": "apartment",     # FRIENDS apartment
    "6255": "apartment",     # Maisonnette
    "6256": "room",          # Studentenkamer
}

ROOM_COUNT_BY_ID: dict[str, int | None] = {
    "104": None,    # Studio
    "6137": 1,      # Loft (open bedroom)
    "105": 1,
    "106": 2,
    "108": 3,
    "382": 4,
}

GRAPHQL_QUERY = """
query Residences($cityId: String!, $pageSize: Int!, $currentPage: Int!) {
  products(
    filter: {
      category_uid: { eq: "%(category)s" }
      city: { eq: $cityId }
      available_to_book: { in: ["%(available)s"] }
    }
    pageSize: $pageSize
    currentPage: $currentPage
  ) {
    total_count
    items {
      sku
      name
      url_key
      city
      resident_type
      no_of_rooms
      living_area
      available_to_book
      price_range {
        minimum_price {
          regular_price { value currency }
        }
      }
    }
  }
}
""" % {"category": RESIDENCES_CATEGORY_UID, "available": DIRECTLY_BOOKABLE_CODE}


def _session() -> "cffi_requests.Session":
    return cffi_requests.Session(impersonate="chrome124")


def _request_headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Origin": "https://www.holland2stay.com",
        "Referer": "https://www.holland2stay.com/find-a-home",
        "Accept": "*/*",
        "Store": "default",
    }


def _normalize_city(city: str) -> str:
    return " ".join((city or "").lower().split())


def _city_id(city: str) -> str | None:
    return CITY_ID_BY_NAME.get(_normalize_city(city))


def _city_name(value: Any) -> str | None:
    if value is None:
        return None
    return CITY_NAME_BY_ID.get(str(value))


def _detail_url(url_key: str | None) -> str | None:
    if not url_key:
        return None
    return RESIDENCE_DETAIL_URL.format(slug=url_key)


def _extract_sku_prefix(sku: str | None) -> str | None:
    if not sku:
        return None
    match = re.match(r"^r-([a-z0-9]+)", sku.lower())
    return match.group(1).upper() if match else None


def _guess_building_image(sku: str | None) -> str | None:
    """Holland2Stay's GraphQL doesn't expose listing images, but the public
    media bucket stores building photos under a predictable prefix derived
    from the SKU (e.g. ``r-btz-431`` -> ``BTZ/BTZ-0.jpg``). The image won't
    always exist, but when it does it's a usable building exterior shot."""
    prefix = _extract_sku_prefix(sku)
    if not prefix:
        return None
    return f"https://api.holland2stay.com/media/pictures/{prefix}/{prefix}-0.jpg"


def _build_listing(item: dict[str, Any], requested_city: str) -> ScrapedListing | None:
    url_key = item.get("url_key")
    detail_url = _detail_url(url_key)
    if not detail_url:
        return None

    raw_name = (item.get("name") or "").strip()
    api_city_id = item.get("city")
    city = _city_name(api_city_id) or requested_city

    price_value = (
        item.get("price_range", {})
        .get("minimum_price", {})
        .get("regular_price", {})
        .get("value")
    )
    price = int(round(price_value)) if isinstance(price_value, (int, float)) and price_value > 0 else None

    area_m2: int | None = None
    living_area = item.get("living_area")
    if living_area is not None:
        try:
            numeric_area = float(str(living_area).replace(",", "."))
            rounded_area = int(round(numeric_area))
            if 5 <= rounded_area <= 500:
                area_m2 = rounded_area
        except (TypeError, ValueError):
            area_m2 = parse_area_m2(living_area)

    resident_type_id = str(item.get("resident_type")) if item.get("resident_type") is not None else None
    rooms_id = str(item.get("no_of_rooms")) if item.get("no_of_rooms") is not None else None
    rooms = ROOM_COUNT_BY_ID.get(rooms_id or "")

    title = raw_name if not city else f"{raw_name}, {city}"
    title = title.strip(" ,")[:140] or "Holland2Stay residence"

    listing = ScrapedListing(
        title=title,
        source=SOURCE_NAME,
        url=detail_url,
        city=city,
        price=price,
        area_m2=area_m2,
        rooms=rooms,
        image_url=_guess_building_image(item.get("sku")),
        description=raw_name,
        availability_status="available",
        is_available=True,
        address_text=None,
        street_name=None,
        house_number=None,
        postal_code=None,
    )
    return listing


def _fetch_page(session, city_id: str, page: int) -> dict[str, Any]:
    payload = {
        "query": GRAPHQL_QUERY,
        "variables": {"cityId": city_id, "pageSize": PAGE_SIZE, "currentPage": page},
    }
    response = session.post(
        API_URL,
        json=payload,
        headers=_request_headers(),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


def fetch_holland2stay_listings(city: str = "Amsterdam") -> list[ScrapedListing]:
    city_id = _city_id(city)
    if not city_id:
        logger.info("holland2stay_skip_unknown_city city=%s", city)
        return []

    session = _session()
    listings: list[ScrapedListing] = []
    seen_skus: set[str] = set()

    for page in range(1, MAX_PAGES_PER_CITY + 1):
        try:
            data = _fetch_page(session, city_id, page)
        except Exception:
            logger.exception("holland2stay_fetch_failed city=%s page=%s", city, page)
            break

        if "errors" in data:
            logger.warning("holland2stay_graphql_errors city=%s errors=%s", city, data["errors"])
            break

        products = data.get("data", {}).get("products", {}) or {}
        items = products.get("items") or []
        total = products.get("total_count") or 0

        if not items:
            break

        for item in items:
            sku = item.get("sku")
            if not sku or sku in seen_skus:
                continue
            listing = _build_listing(item, city)
            if listing is None:
                continue
            seen_skus.add(sku)
            listings.append(listing)

        if len(listings) >= total or len(items) < PAGE_SIZE:
            break

    logger.info("holland2stay_scrape city=%s listings_found=%s", city, len(listings))
    return listings
