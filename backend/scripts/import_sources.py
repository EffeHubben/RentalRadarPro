from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.database.db import SessionLocal, create_database_tables  # noqa: E402
from app.services.source_catalog import import_seed_sources  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Import or update rental source catalog rows idempotently.")
    parser.add_argument(
        "--seed",
        default=str(ROOT / "data" / "rental_sources.seed.json"),
        help="Path to a source seed JSON file.",
    )
    parser.add_argument(
        "--update-registry",
        action="store_true",
        help="Also refresh existing registry-backed rows from current registry defaults.",
    )
    args = parser.parse_args()

    seed_path = Path(args.seed)
    with seed_path.open("r", encoding="utf-8") as handle:
        seed = json.load(handle)

    create_database_tables(run_backfills=False)
    database = SessionLocal()
    try:
        result = import_seed_sources(database, seed, update_registry=args.update_registry)
    finally:
        database.close()

    print(json.dumps({"seed": str(seed_path), **result}, indent=2))


if __name__ == "__main__":
    main()
