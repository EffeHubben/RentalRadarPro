#!/usr/bin/env python3
"""
SQLite hot backup with timestamped filenames and retention.

Usage:
    python scripts/backup_db.py
    python scripts/backup_db.py --db /path/to/db --dest /path/to/backups --keep 14
"""

import argparse
import sqlite3
import sys
from datetime import datetime
from pathlib import Path


DEFAULT_DB = Path(__file__).parent.parent / "rental_radar_pro.db"
DEFAULT_DEST = Path(__file__).parent.parent / "backups"
DEFAULT_KEEP = 7


def backup(db_path: Path, dest_dir: Path, keep: int) -> Path:
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")

    dest_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    stem = db_path.stem
    backup_path = dest_dir / f"{stem}_backup_{timestamp}.db"

    src = sqlite3.connect(str(db_path))
    try:
        dst = sqlite3.connect(str(backup_path))
        try:
            src.backup(dst)
        finally:
            dst.close()
    finally:
        src.close()

    size_kb = backup_path.stat().st_size // 1024
    print(f"Backup created: {backup_path} ({size_kb} KB)")

    _prune(dest_dir, stem, keep)

    return backup_path


def _prune(dest_dir: Path, stem: str, keep: int) -> None:
    pattern = f"{stem}_backup_*.db"
    existing = sorted(dest_dir.glob(pattern))
    to_delete = existing[:-keep] if len(existing) > keep else []

    for old in to_delete:
        old.unlink()
        print(f"Removed old backup: {old.name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="SQLite database backup")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help="Path to SQLite database")
    parser.add_argument("--dest", type=Path, default=DEFAULT_DEST, help="Backup directory")
    parser.add_argument("--keep", type=int, default=DEFAULT_KEEP, help="Number of backups to retain")
    args = parser.parse_args()

    try:
        backup(args.db, args.dest, args.keep)
    except Exception as exc:
        print(f"Backup failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
