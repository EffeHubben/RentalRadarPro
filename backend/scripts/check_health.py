#!/usr/bin/env python3
"""
CLI health check for RentScout backend.

Usage:
    python scripts/check_health.py
    python scripts/check_health.py --url http://localhost:8000
    python scripts/check_health.py --token <admin_jwt>
"""

import argparse
import json
import sys
import urllib.request
import urllib.error
from datetime import datetime


DEFAULT_URL = "http://localhost:8000"


def _get(url: str, token: str | None = None, timeout: int = 10) -> dict:
    req = urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/json")

    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read())


def check_basic(base_url: str) -> bool:
    url = f"{base_url}/health"
    try:
        data = _get(url)
        status = data.get("status", "?")
        db = data.get("database", "?")
        ok = status == "ok"
        mark = "✓" if ok else "✗"
        print(f"{mark}  /health  status={status}  database={db}")
        return ok
    except urllib.error.URLError as exc:
        print(f"✗  /health  unreachable: {exc.reason}")
        return False
    except Exception as exc:
        print(f"✗  /health  error: {exc}")
        return False


def check_admin(base_url: str, token: str) -> bool:
    url = f"{base_url}/api/admin/health"
    try:
        data = _get(url, token=token)
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            print("✗  /api/admin/health  unauthorized (check token)")
        elif exc.code == 403:
            print("✗  /api/admin/health  forbidden (not an admin user)")
        else:
            print(f"✗  /api/admin/health  HTTP {exc.code}")
        return False
    except urllib.error.URLError as exc:
        print(f"✗  /api/admin/health  unreachable: {exc.reason}")
        return False
    except Exception as exc:
        print(f"✗  /api/admin/health  error: {exc}")
        return False

    db = data.get("database", {})
    scanner = data.get("scanner", {})
    config = data.get("config", {})
    failures = data.get("scanner_recent_failures", [])

    db_ok = db.get("status") == "ok"
    db_latency = db.get("latency_ms")
    print(f"{'✓' if db_ok else '✗'}  database  status={db.get('status')}  latency={db_latency}ms")

    scanner_status = scanner.get("status", "?")
    age = scanner.get("age_minutes")
    age_str = f"{age}min ago" if age is not None else "never"
    print(f"   scanner  status={scanner_status}  last_run={age_str}  city={scanner.get('city')}")

    for key, val in config.items():
        mark = "✓" if val else "·"
        print(f"   {mark}  config.{key}={val}")

    if failures:
        print(f"   ⚠  {len(failures)} recent scanner failure(s)")
        for f in failures[:3]:
            print(f"      {f.get('source_id')} / {f.get('city')} → {f.get('status')}: {f.get('error', '')[:80]}")

    checked_at = data.get("checked_at", "")
    if checked_at:
        try:
            dt = datetime.fromisoformat(checked_at)
            print(f"   checked_at={dt.strftime('%Y-%m-%d %H:%M:%S')} UTC")
        except ValueError:
            pass

    return db_ok


def main() -> None:
    parser = argparse.ArgumentParser(description="RentScout health checker")
    parser.add_argument("--url", default=DEFAULT_URL, help="Backend base URL")
    parser.add_argument("--token", default=None, help="Admin JWT access token")
    args = parser.parse_args()

    print(f"Checking {args.url}\n")

    ok = check_basic(args.url)

    if args.token:
        print()
        admin_ok = check_admin(args.url, args.token)
        ok = ok and admin_ok

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
