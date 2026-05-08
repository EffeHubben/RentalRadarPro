from __future__ import annotations

from dataclasses import replace
import re
from urllib.parse import urlsplit, urlunsplit

from app.scrapers.base import ScrapedListing


MAX_ERROR_LENGTH = 240
MAX_DESCRIPTION_LENGTH = 1500
MAX_TITLE_LENGTH = 180

BROKEN_TITLE_MARKERS = {
    "bekijk",
    "read more",
    "meer info",
    "more info",
    "details",
    "klik hier",
}


def normalize_space(value: str | None) -> str:
    return " ".join((value or "").replace("\xa0", " ").split()).strip()


def truncate_error_message(value: str | None, limit: int = MAX_ERROR_LENGTH) -> str | None:
    normalized = normalize_space(value)
    if not normalized:
        return None

    first_line = normalized.splitlines()[0].strip()
    if len(first_line) <= limit:
        return first_line

    return first_line[: limit - 3].rstrip() + "..."


def normalize_listing_url(url: str | None) -> str | None:
    raw_url = normalize_space(url)
    if not raw_url:
        return None

    parsed = urlsplit(raw_url)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc:
        return None

    scheme = parsed.scheme.lower()
    hostname = parsed.hostname.lower() if parsed.hostname else ""

    if not hostname:
        return None

    port = parsed.port
    if (scheme == "http" and port == 80) or (scheme == "https" and port == 443):
        port = None

    netloc = hostname if port is None else f"{hostname}:{port}"
    path = re.sub(r"/{2,}", "/", parsed.path or "/")
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")

    return urlunsplit((scheme, netloc, path, "", ""))


def normalize_optional_url(url: str | None) -> str | None:
    normalized = normalize_listing_url(url)
    return normalized


def normalize_city(city: str | None, fallback_city: str) -> str:
    return normalize_space(city) or normalize_space(fallback_city)


def sanitize_scraped_listing(
    scraped_listing: ScrapedListing,
    *,
    fallback_source: str,
    requested_city: str,
) -> tuple[ScrapedListing | None, str | None]:
    url = normalize_listing_url(scraped_listing.url)
    if not url:
        return None, "invalid_url"

    source = normalize_space(scraped_listing.source) or fallback_source
    if not source:
        return None, "missing_source"

    title = normalize_space(scraped_listing.title)
    description = normalize_space(scraped_listing.description)
    if not title and not description:
        return None, "missing_title_and_description"

    if not title:
        title = description[:MAX_TITLE_LENGTH]

    if len(title) < 5 and len(description) < 24:
        return None, "title_too_short"

    if title.lower() in BROKEN_TITLE_MARKERS:
        return None, "broken_title"

    price = scraped_listing.price if scraped_listing.price and 250 <= scraped_listing.price <= 25000 else None
    area_m2 = scraped_listing.area_m2 if scraped_listing.area_m2 and 5 <= scraped_listing.area_m2 <= 500 else None
    rooms = scraped_listing.rooms if scraped_listing.rooms and 1 <= scraped_listing.rooms <= 20 else None
    image_url = normalize_optional_url(scraped_listing.image_url)

    sanitized = replace(
        scraped_listing,
        title=title[:MAX_TITLE_LENGTH],
        source=source,
        url=url,
        city=normalize_city(scraped_listing.city, requested_city),
        price=price,
        area_m2=area_m2,
        rooms=rooms,
        image_url=image_url,
        description=description[:MAX_DESCRIPTION_LENGTH],
        address_text=normalize_space(scraped_listing.address_text) or None,
        street_name=normalize_space(scraped_listing.street_name) or None,
        house_number=normalize_space(scraped_listing.house_number) or None,
        postal_code=normalize_space(scraped_listing.postal_code) or None,
    )

    return sanitized, None


def source_listing_signature(scraped_listing: ScrapedListing, source_key: str, city: str) -> str | None:
    normalized_title = normalize_space(scraped_listing.title).lower()
    normalized_city = normalize_space(scraped_listing.city or city).lower()
    location_token = normalize_space(
        scraped_listing.address_text
        or scraped_listing.postal_code
        or " ".join(
            part
            for part in [scraped_listing.street_name, scraped_listing.house_number]
            if normalize_space(part)
        )
    ).lower()

    if not normalized_title or not normalized_city or not location_token:
        return None

    price = scraped_listing.price or 0
    area_m2 = scraped_listing.area_m2 or 0
    rooms = scraped_listing.rooms or 0
    return f"{source_key}|{normalized_title}|{normalized_city}|{location_token}|{price}|{area_m2}|{rooms}"
