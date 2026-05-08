from __future__ import annotations

import re
from collections import defaultdict
from typing import Iterable

from sqlalchemy.orm import Session

from app.models.listing import Listing


_NOISY_TITLE_TOKENS = {
    "te",
    "huur",
    "voor",
    "for",
    "rent",
    "huurwoning",
    "appartement",
    "apartment",
    "studio",
    "kamer",
    "room",
    "huis",
    "house",
    "in",
    "te-huur",
    "the",
    "een",
    "a",
    "an",
}


def normalize_key_part(value: str | int | None) -> str:
    if value is None:
        return ""

    normalized = str(value).lower().replace("\xa0", " ")
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    return normalized.strip("-")


def normalize_postal_code(value: str | None) -> str:
    return normalize_key_part(value).replace("-", "")


def normalize_title_signature(title: str | None) -> str:
    """Reduce a title to a slot of meaningful tokens for fallback duplicate matching."""
    if not title:
        return ""

    lowered = title.lower().replace("\xa0", " ")
    cleaned = re.sub(r"[^a-z0-9]+", " ", lowered).split()
    meaningful = [token for token in cleaned if len(token) >= 3 and token not in _NOISY_TITLE_TOKENS]
    return "-".join(meaningful[:6])


def build_duplicate_key(listing: Listing) -> str | None:
    postal_code = normalize_postal_code(listing.postal_code)
    house_number = normalize_key_part(listing.house_number)
    street_name = normalize_key_part(listing.street_name)
    city = normalize_key_part(listing.city)
    price = listing.price
    area_m2 = listing.area_m2

    if postal_code and house_number:
        return f"pc-house:{postal_code}:{house_number}"

    if street_name and house_number and city:
        return f"street-house-city:{street_name}:{house_number}:{city}"

    if street_name and city and area_m2 and price:
        return f"street-city-area-price:{street_name}:{city}:{area_m2}:{price}"

    title_signature = normalize_title_signature(listing.title)
    if title_signature and city and area_m2 and price:
        return f"title-city-area-price:{title_signature}:{city}:{area_m2}:{price}"

    return None


def assign_duplicate_metadata(listing: Listing) -> str | None:
    duplicate_key = build_duplicate_key(listing)

    listing.duplicate_key = duplicate_key
    listing.canonical_key = duplicate_key
    listing.duplicate_group_id = duplicate_key

    if not duplicate_key:
        listing.source_count = 1

    return duplicate_key


def refresh_duplicate_group(database: Session, duplicate_key: str | None) -> None:
    if not duplicate_key:
        return

    group = (
        database.query(Listing)
        .filter(Listing.duplicate_group_id == duplicate_key)
        .all()
    )
    source_count = max(1, len({listing.source for listing in group if listing.source}))

    for listing in group:
        listing.canonical_key = duplicate_key
        listing.source_count = source_count


def refresh_duplicate_groups(database: Session, listings: Iterable[Listing]) -> None:
    keys_by_listing_id: dict[int, str | None] = {}

    for listing in listings:
        keys_by_listing_id[listing.id] = assign_duplicate_metadata(listing)

    for duplicate_key in set(keys_by_listing_id.values()):
        refresh_duplicate_group(database, duplicate_key)


def duplicate_sources_for_listings(
    database: Session,
    listings: Iterable[Listing],
) -> dict[str, list[dict]]:
    duplicate_keys = {
        listing.duplicate_group_id
        for listing in listings
        if listing.duplicate_group_id
    }

    if not duplicate_keys:
        return {}

    grouped_listings = (
        database.query(Listing)
        .filter(Listing.duplicate_group_id.in_(duplicate_keys))
        .order_by(Listing.source.asc(), Listing.last_seen_at.desc())
        .all()
    )
    groups: dict[str, list[dict]] = defaultdict(list)
    seen_source_urls: set[tuple[str, str, str]] = set()

    for listing in grouped_listings:
        group_id = listing.duplicate_group_id

        if not group_id:
            continue

        source_key = (group_id, listing.source or "", listing.url or "")

        if source_key in seen_source_urls:
            continue

        seen_source_urls.add(source_key)
        groups[group_id].append(
            {
                "id": listing.id,
                "source": listing.source,
                "url": listing.url,
                "title": listing.title,
            }
        )

    return groups
