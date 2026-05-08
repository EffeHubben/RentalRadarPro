"""Scanner CLI — drives ``run_scrapers`` across one or many cities.

The scanner used to be hard-wired to a single city (``--city Breda``). This
module now iterates a configurable list of cities so RentScout populates
listings nationwide. Each city is scanned one source at a time with a small
pause between cities, keeping the load respectful per-site.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import time
from datetime import datetime, timedelta

from sqlalchemy import func

from app.api.scrapers import ScraperRunRequest, run_scrapers
from app.core.config import settings
from app.database.db import SessionLocal, create_database_tables
from app.models.scan_history import ScanHistory
from app.sources.registry import RENTAL_SOURCES, RentalSource


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("rentscout.scanner.cli")


def automatic_source_keys() -> list[str]:
    return [
        source.source_key
        for source in RENTAL_SOURCES
        if source.enabled and source.auto_scan_enabled
    ]


def _stagger_seconds(source: RentalSource, city: str) -> int:
    digest = hashlib.sha1(f"{source.source_key}|{city.lower()}".encode("utf-8")).hexdigest()
    return int(digest[:4], 16) % max(60, source.interval_minutes * 60)


def _last_finished_at(database, source_key: str, city: str) -> datetime | None:
    return (
        database.query(func.max(ScanHistory.finished_at))
        .filter(
            ScanHistory.source_id == source_key,
            func.lower(ScanHistory.city) == city.lower(),
            ScanHistory.finished_at.isnot(None),
        )
        .scalar()
    )


def due_sources_for_city(database, city: str) -> list[str]:
    now = datetime.utcnow()
    due_sources: list[str] = []

    for source in RENTAL_SOURCES:
        if not source.enabled or not source.auto_scan_enabled:
            continue

        last_finished_at = _last_finished_at(database, source.source_key, city)
        if last_finished_at is None:
            due_sources.append(source.source_key)
            continue

        interval = max(source.interval_minutes, 0)
        next_due_at = last_finished_at + timedelta(
            minutes=interval,
            seconds=_stagger_seconds(source, city),
        )
        if next_due_at <= now:
            due_sources.append(source.source_key)

    return due_sources


def run_once(city: str, sources: list[str] | None, dry_run: bool = False) -> dict:
    selected_sources = sources or automatic_source_keys()

    if dry_run:
        return {
            "status": "dry_run",
            "city": city,
            "sources": selected_sources,
            "scan_interval_minutes": settings.listing_scan_interval_minutes,
        }

    database = SessionLocal()
    try:
        return run_scrapers(ScraperRunRequest(city=city, sources=selected_sources), database)
    finally:
        database.close()


def run_due(city: str, dry_run: bool = False) -> dict:
    database = SessionLocal()
    try:
        sources = due_sources_for_city(database, city)
    finally:
        database.close()
    return run_once(city, sources, dry_run=dry_run)


def run_cycle(
    cities: list[str],
    *,
    max_cities_per_cycle: int,
    pause_seconds: int,
    dry_run: bool = False,
) -> list[dict]:
    """Run one scan pass across many cities.

    Picks the cities most overdue first, scans up to ``max_cities_per_cycle``
    of them, and only runs sources that are due for that city.
    """
    if not cities:
        return []

    database = SessionLocal()
    try:
        scored: list[tuple[datetime | None, str, list[str]]] = []
        for city in cities:
            due_for_city = due_sources_for_city(database, city)
            if not due_for_city:
                continue

            most_recent = (
                database.query(func.max(ScanHistory.finished_at))
                .filter(
                    func.lower(ScanHistory.city) == city.lower(),
                    ScanHistory.finished_at.isnot(None),
                )
                .scalar()
            )
            scored.append((most_recent, city, due_for_city))
    finally:
        database.close()

    if not scored:
        logger.info(
            "scanner_cycle_idle reason=no_due_cities cities=%s",
            json.dumps(cities, default=str),
        )
        return []

    scored.sort(key=lambda entry: (entry[0] is not None, entry[0] or datetime.min))
    selected = scored[: max(1, max_cities_per_cycle)]

    results: list[dict] = []
    for index, (last_finished_at, city, due_for_city) in enumerate(selected):
        logger.info(
            "scanner_cycle_city city=%s sources=%s last_finished_at=%s",
            city,
            json.dumps(due_for_city),
            last_finished_at.isoformat() if last_finished_at else None,
        )
        result = run_once(city, due_for_city, dry_run=dry_run)
        results.append(result)
        if index < len(selected) - 1 and pause_seconds > 0:
            time.sleep(pause_seconds)

    return results


def run_forever(
    cities: list[str],
    *,
    sleep_seconds: int,
    max_cities_per_cycle: int,
    pause_seconds: int,
    dry_run: bool = False,
) -> None:
    logger.info(
        "continuous_scanner_start cities=%s sleep_seconds=%s max_cities_per_cycle=%s dry_run=%s",
        json.dumps(cities, default=str),
        sleep_seconds,
        max_cities_per_cycle,
        dry_run,
    )

    while True:
        results = run_cycle(
            cities,
            max_cities_per_cycle=max_cities_per_cycle,
            pause_seconds=pause_seconds,
            dry_run=dry_run,
        )
        if results:
            for result in results:
                logger.info("continuous_scan_result %s", json.dumps(result, default=str))
        else:
            logger.info("continuous_scan_idle no_sources_due=true")

        time.sleep(sleep_seconds)


def _resolve_cities(args: argparse.Namespace) -> list[str]:
    """City precedence: --city flag (single), --cities flag (list), or settings.scan_cities."""
    if args.cities:
        cities: list[str] = []
        for chunk in args.cities:
            cities.extend(part.strip() for part in chunk.split(",") if part.strip())
        if cities:
            return cities

    if args.city:
        return [args.city]

    return settings.scan_cities


def main() -> None:
    parser = argparse.ArgumentParser(description="Run RentScout listing scans locally or in production.")
    parser.add_argument("--city", default=None, help="Scan a single city (overrides --cities and LISTING_SCAN_CITIES).")
    parser.add_argument(
        "--cities",
        action="append",
        default=[],
        help="Comma-separated city list. Repeat or comma-separate for multiple.",
    )
    parser.add_argument("--source", action="append", dest="sources", help="Source key to scan. Repeat for multiple.")
    parser.add_argument("--due", action="store_true", help="Only scan automatic sources that are due.")
    parser.add_argument("--continuous", action="store_true", help="Run scans in a local loop covering many cities.")
    parser.add_argument("--sleep-seconds", type=int, default=60)
    parser.add_argument("--max-cities-per-cycle", type=int, default=settings.listing_scan_max_cities_per_cycle)
    parser.add_argument("--per-city-pause-seconds", type=int, default=settings.listing_scan_per_city_pause_seconds)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    create_database_tables()

    cities = _resolve_cities(args)

    if args.continuous:
        run_forever(
            cities,
            sleep_seconds=args.sleep_seconds,
            max_cities_per_cycle=args.max_cities_per_cycle,
            pause_seconds=args.per_city_pause_seconds,
            dry_run=args.dry_run,
        )
        return

    if len(cities) == 1 and not args.due and args.sources:
        result = run_once(cities[0], args.sources, dry_run=args.dry_run)
        print(json.dumps(result, indent=2, default=str))
        return

    if len(cities) == 1 and args.due:
        result = run_due(cities[0], dry_run=args.dry_run)
        print(json.dumps(result, indent=2, default=str))
        return

    if len(cities) == 1:
        result = run_once(cities[0], args.sources, dry_run=args.dry_run)
        print(json.dumps(result, indent=2, default=str))
        return

    results = run_cycle(
        cities,
        max_cities_per_cycle=args.max_cities_per_cycle,
        pause_seconds=args.per_city_pause_seconds,
        dry_run=args.dry_run,
    )
    print(json.dumps({"cities": cities, "runs": results}, indent=2, default=str))


if __name__ == "__main__":
    main()
