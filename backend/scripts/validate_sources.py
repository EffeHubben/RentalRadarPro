"""Validate generic_html source candidates against a real city.

Runs each candidate source's fetcher once and reports outcome so we can
decide which ones to auto-enable. Intended to be run locally during
source-onboarding, not in production. Stays single-city by default to keep
the run respectful.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.scrapers.generic_sources import SourceBlockedError  # noqa: E402
from app.sources.registry import RENTAL_SOURCES  # noqa: E402


def run_with_timeout(source, city: str, timeout_seconds: int):
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(source.fetch_listings, city)
    try:
        return future.result(timeout=timeout_seconds)
    except FutureTimeoutError as error:
        future.cancel()
        executor.shutdown(wait=False, cancel_futures=True)
        raise TimeoutError(f"Timeout after {timeout_seconds}s") from error
    finally:
        if future.done():
            executor.shutdown(wait=False, cancel_futures=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--city", default="Breda")
    parser.add_argument(
        "--types",
        default="generic_html",
        help="Comma-separated source_types to validate (default: generic_html).",
    )
    parser.add_argument(
        "--include-auto",
        action="store_true",
        help="Also include sources already auto_scan_enabled=True.",
    )
    parser.add_argument("--timeout", type=int, default=45, help="Per-source timeout seconds.")
    parser.add_argument(
        "--source",
        action="append",
        dest="sources",
        help="Limit validation to one or more source_keys.",
    )
    parser.add_argument("--out", default="tmp/source_validation.json")
    args = parser.parse_args()

    selected_types = {value.strip() for value in args.types.split(",") if value.strip()}

    candidates = []
    for source in RENTAL_SOURCES:
        if not source.enabled:
            continue
        if source.source_type not in selected_types:
            continue
        if not args.include_auto and source.auto_scan_enabled:
            continue
        if args.sources and source.source_key not in args.sources:
            continue
        candidates.append(source)

    print(
        f"validating {len(candidates)} sources against city={args.city!r} "
        f"timeout={args.timeout}s",
        flush=True,
    )

    results = []
    started_total = time.time()

    for index, source in enumerate(candidates, start=1):
        started = time.time()
        outcome = {
            "source_key": source.source_key,
            "display_name": source.display_name,
            "currently_auto": source.auto_scan_enabled,
            "status": "unknown",
            "listing_count": 0,
            "error": None,
            "duration_s": 0.0,
            "with_image": 0,
            "with_price": 0,
            "with_area": 0,
            "sample_url": None,
            "sample_title": None,
        }

        print(f"[{index}/{len(candidates)}] {source.source_key} ...", flush=True)

        try:
            listings = run_with_timeout(source, args.city, args.timeout)
            outcome["listing_count"] = len(listings)
            outcome["with_image"] = sum(1 for entry in listings if entry.image_url)
            outcome["with_price"] = sum(1 for entry in listings if entry.price)
            outcome["with_area"] = sum(1 for entry in listings if entry.area_m2)
            if listings:
                outcome["status"] = "success"
                outcome["sample_url"] = listings[0].url
                outcome["sample_title"] = listings[0].title
            else:
                outcome["status"] = "no_results"
        except SourceBlockedError as error:
            outcome["status"] = "blocked"
            outcome["error"] = str(error)
        except TimeoutError as error:
            outcome["status"] = "timeout"
            outcome["error"] = str(error)
        except Exception as error:  # pragma: no cover - validation tool
            outcome["status"] = "error"
            outcome["error"] = repr(error)
        finally:
            outcome["duration_s"] = round(time.time() - started, 1)

        print(
            f"  -> {outcome['status']:10s} count={outcome['listing_count']:3d} "
            f"img={outcome['with_image']:3d} price={outcome['with_price']:3d} "
            f"area={outcome['with_area']:3d} {outcome['duration_s']}s",
            flush=True,
        )
        results.append(outcome)

    output_path = ROOT / args.out
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(results, indent=2, default=str))

    elapsed = round(time.time() - started_total, 1)
    summary = {
        "success": sum(1 for entry in results if entry["status"] == "success"),
        "no_results": sum(1 for entry in results if entry["status"] == "no_results"),
        "blocked": sum(1 for entry in results if entry["status"] == "blocked"),
        "timeout": sum(1 for entry in results if entry["status"] == "timeout"),
        "error": sum(1 for entry in results if entry["status"] == "error"),
    }

    print(f"\nelapsed={elapsed}s summary={json.dumps(summary)}\nsaved -> {output_path}")


if __name__ == "__main__":
    main()
