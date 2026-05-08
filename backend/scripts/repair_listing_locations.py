"""
Dry-run-first repair script for conservative listing city/coordinate fixes.

This script only trusts strong signals already present in the stored listing:
- precise scraped address text (when stored with exact/street/postcode precision)
- source URL city slugs or query params
- title city names only as supporting evidence

It never geocodes externally and never invents exact addresses. When it can
repair a listing safely, it writes city-level coordinates only.

Usage (from backend/):
    .venv/bin/python scripts/repair_listing_locations.py
    .venv/bin/python scripts/repair_listing_locations.py --apply
    .venv/bin/python scripts/repair_listing_locations.py --limit 100
"""

from __future__ import annotations

import argparse
from collections import Counter
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import os
os.environ.setdefault("DATABASE_URL", "sqlite:///./rental_radar_pro.db")
os.environ.setdefault("JWT_SECRET_KEY", "repair-script-placeholder")

from app.database.db import SessionLocal, create_database_tables
from app.models.listing import Listing
from app.services.listing_location_repair import apply_repair_plan, plan_listing_location_repair


def example_line(listing: Listing, action: str, reason: str, updates: dict[str, object]) -> str:
    current_city = listing.city or "None"
    next_city = updates.get("city", listing.city) or "None"
    current_lat = "None" if listing.latitude is None else f"{listing.latitude:.4f}"
    current_lon = "None" if listing.longitude is None else f"{listing.longitude:.4f}"
    next_lat = updates.get("latitude", listing.latitude)
    next_lon = updates.get("longitude", listing.longitude)
    next_lat_text = "None" if next_lat is None else f"{float(next_lat):.4f}"
    next_lon_text = "None" if next_lon is None else f"{float(next_lon):.4f}"
    title = (listing.title or "").replace("\n", " ").strip()[:72]
    return (
        f"  id={listing.id} action={action} city={current_city} -> {next_city} "
        f"coords=({current_lat},{current_lon}) -> ({next_lat_text},{next_lon_text}) "
        f'reason="{reason}" title="{title}"'
    )


def print_summary(prefix: str, counts: Counter[str]) -> None:
    print(prefix)
    print(f"  checked: {counts['checked']}")
    print(f"  unchanged: {counts['noop']}")
    print(f"  repair_location: {counts['repair_location']}")
    print(f"  clear_coordinates: {counts['clear_coordinates']}")
    print(f"  clear_city_and_coordinates: {counts['clear_city_and_coordinates']}")
    print(f"  report_only: {counts['report_only']}")
    print(f"  writable_changes: {counts['writable_changes']}")


def repair_locations(*, apply: bool, limit: int | None) -> None:
    create_database_tables(run_backfills=False)
    database = SessionLocal()

    try:
        query = database.query(Listing).filter(Listing.is_active.is_(True)).order_by(Listing.id)
        if limit:
            query = query.limit(limit)
        listings = query.all()

        before_counts: Counter[str] = Counter()
        changed_examples: list[str] = []
        report_examples: list[str] = []

        for listing in listings:
            plan = plan_listing_location_repair(listing)
            before_counts["checked"] += 1
            before_counts[plan.action] += 1

            if plan.writes:
                before_counts["writable_changes"] += 1
                if len(changed_examples) < 20:
                    changed_examples.append(example_line(listing, plan.action, plan.reason, plan.updates))
            elif plan.action == "report_only" and len(report_examples) < 10:
                report_examples.append(example_line(listing, plan.action, plan.reason, {}))

            if apply:
                apply_repair_plan(listing, plan)

        if apply:
            database.commit()
            after_counts: Counter[str] = Counter()
            for listing in listings:
                after_counts[plan_listing_location_repair(listing).action] += 1
            after_counts["checked"] = len(listings)
            after_counts["writable_changes"] = 0

            print_summary("Before apply:", before_counts)
            print_summary("After apply:", after_counts)
            print()
            print(f"Applied {before_counts['writable_changes']} conservative location repairs.")
        else:
            database.rollback()
            print_summary("Dry run summary:", before_counts)
            print()
            if changed_examples:
                print("Examples of rows that would change:")
                for line in changed_examples:
                    print(line)
            if report_examples:
                print()
                print("Examples of suspicious rows that would only be reported:")
                for line in report_examples:
                    print(line)
            if before_counts["writable_changes"] > 0:
                print("\nRun with --apply to write the safe repairs above.")
    finally:
        database.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Conservatively repair listing city/coordinate rows")
    parser.add_argument("--apply", action="store_true", help="Write changes (default: dry run)")
    parser.add_argument("--limit", type=int, default=None, help="Max active listings to inspect")
    args = parser.parse_args()
    repair_locations(apply=args.apply, limit=args.limit)


if __name__ == "__main__":
    main()
