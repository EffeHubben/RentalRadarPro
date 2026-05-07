import argparse
import json
import logging
import time
from datetime import datetime

from app.api.scrapers import ScraperRunRequest, run_scrapers
from app.core.config import settings
from app.database.db import SessionLocal, create_database_tables
from app.sources.registry import RENTAL_SOURCES


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


def due_source_keys() -> list[str]:
    now = datetime.utcnow()
    due_sources = []
    for source in RENTAL_SOURCES:
        if not source.enabled or not source.auto_scan_enabled:
            continue

        next_due_at = source.next_due_at()
        if next_due_at is None or next_due_at <= now:
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
    return run_once(city, due_source_keys(), dry_run=dry_run)


def run_forever(city: str, sleep_seconds: int, dry_run: bool = False) -> None:
    logger.info("continuous_scanner_start city=%s sleep_seconds=%s dry_run=%s", city, sleep_seconds, dry_run)

    while True:
        selected_sources = due_source_keys()
        if selected_sources:
            result = run_once(city, selected_sources, dry_run=dry_run)
            logger.info("continuous_scan_result %s", json.dumps(result, default=str))
        else:
            logger.info("continuous_scan_idle no_sources_due=true")

        time.sleep(sleep_seconds)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run RentScout listing scans locally.")
    parser.add_argument("--city", default=settings.default_city)
    parser.add_argument("--source", action="append", dest="sources", help="Source key to scan. Repeat for multiple.")
    parser.add_argument("--due", action="store_true", help="Only scan automatic sources that are due.")
    parser.add_argument("--continuous", action="store_true", help="Run due scans in a local loop.")
    parser.add_argument("--sleep-seconds", type=int, default=60)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    create_database_tables()

    if args.continuous:
        run_forever(args.city, args.sleep_seconds, dry_run=args.dry_run)
        return

    result = run_due(args.city, dry_run=args.dry_run) if args.due else run_once(args.city, args.sources, dry_run=args.dry_run)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
