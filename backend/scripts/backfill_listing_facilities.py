"""Backfill inferred facility fields for existing listings.

For apartments, houses and studios whose private_kitchen / private_bathroom /
private_toilet fields are NULL and whose text contains no broad shared-housing
signals, set those fields to True (the same assumption now applied at scrape
time and at query time).

Runs in dry-run mode by default; use --apply to persist changes.

Usage:
    python scripts/backfill_listing_facilities.py
    python scripts/backfill_listing_facilities.py --apply
    python scripts/backfill_listing_facilities.py --apply --batch-size 500
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("DATABASE_URL", "sqlite:///rental_radar_pro.db")
os.environ.setdefault("JWT_SECRET_KEY", "backfill-dummy-secret-not-used")
os.environ.setdefault("REFRESH_COOKIE_SECURE", "false")
os.environ.setdefault("REFRESH_COOKIE_SAMESITE", "lax")

from app.database.db import SessionLocal
from app.models.listing import Listing
from app.services.listing_quality import PRIVATE_ASSUMPTION_TYPES, SHARED_SIGNALS, includes_any


def _has_shared_signals(listing: Listing) -> bool:
    text = " ".join(
        filter(None, [listing.title or "", listing.description or ""])
    ).lower()
    return includes_any(text, SHARED_SIGNALS)


def backfill(*, apply: bool, batch_size: int) -> None:
    db = SessionLocal()
    try:
        candidates = (
            db.query(Listing)
            .filter(
                Listing.property_type.in_(list(PRIVATE_ASSUMPTION_TYPES)),
                Listing.is_shared.isnot(True),
            )
            .all()
        )

        updated = 0
        skipped_shared_signal = 0
        skipped_already_set = 0

        for listing in candidates:
            if _has_shared_signals(listing):
                skipped_shared_signal += 1
                continue

            changed = False
            if listing.private_kitchen is None:
                listing.private_kitchen = True
                changed = True
            if listing.private_bathroom is None:
                listing.private_bathroom = True
                changed = True
            if listing.private_toilet is None:
                listing.private_toilet = True
                changed = True

            if changed:
                updated += 1
            else:
                skipped_already_set += 1

            if apply and updated % batch_size == 0 and updated > 0:
                db.commit()
                print(f"  committed {updated} so far …")

        if apply:
            db.commit()
            print(f"Applied: {updated} listings updated.")
        else:
            print(f"Dry-run: would update {updated} listings.")

        print(f"Skipped (shared signals): {skipped_shared_signal}")
        print(f"Skipped (already set):    {skipped_already_set}")
        print(f"Total candidates:         {len(candidates)}")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Persist changes to the database.")
    parser.add_argument("--batch-size", type=int, default=200, help="Commit every N rows.")
    args = parser.parse_args()
    backfill(apply=args.apply, batch_size=args.batch_size)
