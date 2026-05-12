"""Verify whether existing listings are still available at the source.

The scanner only ingests listings it finds in search results. When a listing
is taken offline or marked rented at the source, our database keeps showing
it as active. This module periodically refetches stale listings, classifies
their current state, and marks rented/removed ones so the public API hides
them.
"""

from __future__ import annotations

from datetime import datetime, timedelta
import logging
from typing import Literal

from playwright.sync_api import sync_playwright
from sqlalchemy.orm import Session

from app.models.listing import Listing


logger = logging.getLogger("rentscout.verifier")


REMOVED_MARKERS = (
    "pagina niet gevonden",
    "page not found",
    "404 - not found",
    "advertentie bestaat niet",
    "advertentie is verwijderd",
    "deze woning is niet meer beschikbaar",
    "object niet gevonden",
    "listing not found",
    "this listing no longer exists",
    "this property is no longer available",
)

RENTED_MARKERS = (
    "verhuurd",
    "rented",
    "let agreed",
    "no longer available",
    "niet meer beschikbaar",
    "advertentie gesloten",
)

RESERVED_MARKERS = (
    "onder optie",
    "under option",
    "gereserveerd",
    "reserved",
    "in optie",
)

Verdict = Literal["active", "rented", "reserved", "removed", "unknown"]


def fetch_listing_page(url: str) -> tuple[int | None, str | None]:
    """Fetch a single listing URL via Playwright. Returns (status, html)."""
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel="chrome", headless=True)
            page = browser.new_page(
                user_agent=(
                    "Mozilla/5.0 (X11; Linux x86_64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/122.0 Safari/537.36"
                )
            )
            response = page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(1500)
            html = page.content()
            status = response.status if response else None
            browser.close()
            return status, html
    except Exception as error:
        logger.warning("verify_fetch_failed url=%s error=%s", url, error)
        return None, None


def classify_listing(status_code: int | None, html: str | None) -> Verdict:
    """Classify a listing based on HTTP status and page content."""
    if status_code in (404, 410):
        return "removed"

    if status_code is None or html is None:
        return "unknown"

    lower = html.lower()

    if any(marker in lower for marker in REMOVED_MARKERS):
        return "removed"

    if any(marker in lower for marker in RENTED_MARKERS):
        return "rented"

    if any(marker in lower for marker in RESERVED_MARKERS):
        return "reserved"

    return "active"


def apply_verdict(listing: Listing, verdict: Verdict, now: datetime) -> None:
    listing.last_checked_at = now

    if verdict == "removed":
        listing.is_active = False
        listing.availability_status = "rented"
        listing.is_available = False
    elif verdict == "rented":
        listing.availability_status = "rented"
        listing.is_available = False
    elif verdict == "reserved":
        listing.availability_status = "reserved"
        listing.is_available = False
    elif verdict == "active":
        listing.is_active = True
        if listing.availability_status in (None, "", "unknown"):
            listing.availability_status = "available"
            listing.is_available = True


def select_stale_listings(
    database: Session,
    batch_size: int,
    max_age_hours: int,
) -> list[Listing]:
    cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)
    return (
        database.query(Listing)
        .filter(
            Listing.is_active.is_(True),
            Listing.last_checked_at < cutoff,
            ~Listing.availability_status.in_(["rented", "reserved"]),
        )
        .order_by(Listing.last_checked_at.asc())
        .limit(batch_size)
        .all()
    )


def verify_stale_listings(
    database: Session,
    *,
    batch_size: int = 20,
    max_age_hours: int = 12,
) -> dict:
    """Re-fetch a batch of stale listings and update their status."""
    listings = select_stale_listings(database, batch_size, max_age_hours)

    if not listings:
        logger.info("verify_batch_idle no_stale_listings=true")
        return {"total": 0, "active": 0, "rented": 0, "reserved": 0, "removed": 0, "unknown": 0}

    results = {"total": len(listings), "active": 0, "rented": 0, "reserved": 0, "removed": 0, "unknown": 0}

    for listing in listings:
        status, html = fetch_listing_page(listing.url)
        verdict = classify_listing(status, html)
        results[verdict] += 1

        logger.info(
            "verify_listing id=%s url=%s status=%s verdict=%s",
            listing.id,
            listing.url,
            status,
            verdict,
        )

        apply_verdict(listing, verdict, datetime.utcnow())

    database.commit()
    logger.info("verify_batch_complete %s", results)
    return results
