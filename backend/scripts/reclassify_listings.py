"""
Dry-run backfill script for property_type reclassification.

Reads all active listings, recalculates property_type using the updated
classification logic, and reports changes. Does NOT write unless --apply is passed.

Usage (from backend/):
    .venv/bin/python scripts/reclassify_listings.py            # dry run
    .venv/bin/python scripts/reclassify_listings.py --apply    # write changes
    .venv/bin/python scripts/reclassify_listings.py --limit 100  # cap rows checked
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import os
os.environ.setdefault("DATABASE_URL", "sqlite:///./rental_radar_pro.db")
os.environ.setdefault("JWT_SECRET_KEY", "reclassify-script-placeholder")

from app.database.db import SessionLocal, create_database_tables
from app.models.listing import Listing
from app.services.listing_quality import infer_property_type, normalize_space


def reclassify(*, apply: bool, limit: int | None) -> None:
    create_database_tables(run_backfills=False)
    database = SessionLocal()
    try:
        query = database.query(Listing).filter(Listing.is_active.is_(True))
        if limit:
            query = query.limit(limit)
        listings = query.all()

        counts: dict[str, int] = {"unchanged": 0, "changed": 0, "total": len(listings)}
        examples: list[dict] = []

        for listing in listings:
            combined = normalize_space(
                f"{listing.title or ''} {listing.description or ''} {listing.url or ''}"
            ).lower()
            new_type = infer_property_type(combined)
            old_type = listing.property_type or "unknown"

            if new_type == old_type:
                counts["unchanged"] += 1
                continue

            counts["changed"] += 1
            if len(examples) < 20:
                examples.append({
                    "id": listing.id,
                    "title": (listing.title or "")[:60],
                    "old": old_type,
                    "new": new_type,
                })

            if apply:
                listing.property_type = new_type

        if apply:
            database.commit()
            print(f"Applied {counts['changed']} reclassifications ({counts['total']} rows checked).")
        else:
            print(f"Dry run: {counts['changed']} of {counts['total']} listings would change.")
            print(f"  unchanged: {counts['unchanged']}")
            print()
            for ex in examples:
                print(f"  id={ex['id']} {ex['old']} → {ex['new']}  \"{ex['title']}\"")
            if not apply and counts["changed"] > 0:
                print("\nRun with --apply to commit changes.")
    finally:
        database.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Reclassify listing property types")
    parser.add_argument("--apply", action="store_true", help="Write changes (default: dry run)")
    parser.add_argument("--limit", type=int, default=None, help="Max listings to inspect")
    args = parser.parse_args()
    reclassify(apply=args.apply, limit=args.limit)


if __name__ == "__main__":
    main()
