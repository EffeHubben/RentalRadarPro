# RentScout scanner

Run these commands from the project root unless noted otherwise.

## Multi-city continuous scanner (recommended for production)

The scanner now iterates a list of cities so the database covers the whole
Netherlands instead of a single city. The list comes from
`LISTING_SCAN_CITIES` (comma-separated) and falls back to `default_city` if
that env var is empty.

Defaults baked into `app/core/config.py` and `docker-compose.yml`:

```
LISTING_SCAN_CITIES="Amsterdam,Rotterdam,Den Haag,Utrecht,Eindhoven,Tilburg,Breda,Den Bosch,Nijmegen,Arnhem,Groningen,Maastricht,Leiden,Delft,Haarlem,Almere,Amersfoort,Apeldoorn,Enschede,Zwolle,Dordrecht,Zoetermeer,Etten-Leur,Roosendaal,Bergen op Zoom"
LISTING_SCAN_MAX_CITIES_PER_CYCLE=6   # how many cities to scan per cycle
LISTING_SCAN_PER_CITY_PAUSE_SECONDS=8 # respectful pause between cities
LISTING_SCAN_INTERVAL_MINUTES=15      # interval per source/city
```

Each cycle the scanner:

1. Looks at `scan_history` to find the cities most overdue for a refresh.
2. Scores cities by staleness, low active-listing inventory, and due source
   coverage.
3. Picks up to `LISTING_SCAN_MAX_CITIES_PER_CYCLE` of them.
4. For each picked city, runs only enabled automatic sources that are due.
5. Applies source-level cooldowns for recent failures/blocks and repeated
   zero-result runs.
6. Sleeps `LISTING_SCAN_PER_CITY_PAUSE_SECONDS` between cities, then sleeps
   `--sleep-seconds` between cycles.

This avoids hammering any single source for too many cities back-to-back.
Manual and external-only sources remain visible in the frontend source panel,
but they are never selected for automatic scanner cycles. Limited sources are
also skipped unless they have a validated fetch implementation and
`auto_scan_enabled=True`.

Current continuously scanned sources are:

```text
marktplaats, funda, ikwilhuren, heimstaden, rotsvast, interhouse, maxx_aanhuur, vesteda, expat_rentals
```

The larger registry also contains manual/limited external sources for housing
corporations, student housing, expat platforms, property managers, regional
portals, and temporary housing. These are links for users to open themselves;
they are not inserted as fake listings.

Run one cycle locally without committing changes:

```bash
cd backend
.venv/bin/python -m app.services.scanner --dry-run
```

Override the city list at the CLI:

```bash
cd backend
.venv/bin/python -m app.services.scanner --cities "Rotterdam,Amsterdam,Utrecht"
```

## One-off single-city scans

Run all automatic sources once for one city:

```bash
cd backend
.venv/bin/python -m app.services.scanner --city Breda
```

Run one source once:

```bash
cd backend
.venv/bin/python -m app.services.scanner --city Breda --source marktplaats
```

Preview which automatic sources would run without writing listings:

```bash
cd backend
.venv/bin/python -m app.services.scanner --city Breda --dry-run
```

## Continuous local scanner

Run due automatic sources in a loop:

```bash
cd backend
.venv/bin/python -m app.services.scanner --city Breda --continuous --sleep-seconds 60
```

Run only sources whose interval/backoff says they are due:

```bash
cd backend
.venv/bin/python -m app.services.scanner --city Breda --due
```

## Docker Compose worker

Production should run the scanner server-side as a separate Docker Compose service. The frontend should only read stored listings and source status; it should not trigger `/api/scrapers/run`.

Start the scanner worker:

```bash
docker compose up -d scanner
```

View scanner logs:

```bash
docker compose logs -f scanner
```

Stop the scanner without stopping the backend:

```bash
docker compose stop scanner
```

The Compose worker runs:

```bash
python -m app.services.scanner --continuous --sleep-seconds 300
```

It picks up the city list from `LISTING_SCAN_CITIES` (set by the
`x-backend-environment` block in `docker-compose.yml`).

The worker uses the same Docker volume as the backend, so it writes listings and scan history to the same SQLite database. Back up the SQLite database before the first production deploy that enables the scanner worker.

## Logs and database checks

Scanner logs are written to stdout by the CLI and to the backend process logs when scans are triggered through the API. Each source writes `scan_start`, `scan_finished`, `scan_blocked`, or `scan_failed` log lines.

Each run records:

- source key and display name
- scraped, created, updated, skipped, and duplicate counts
- timeout or failure type when a run does not complete
- duration in milliseconds

## Source health checks

Admin source health is available at:

```bash
curl http://localhost:8000/api/sources
```

Admin-authenticated source health is also available through:

```bash
curl -H "Authorization: Bearer <admin-access-token>" http://localhost:8000/api/admin/sources
```

Useful fields:

- `last_scan_finished_at`: most recent run end time
- `last_success_at`: most recent successful or no-results run
- `last_failed_at`: most recent failed or blocked run
- `last_failed_error`: latest safe truncated error message
- `total_listing_count` and `active_listing_count`: current stored inventory by source
- `next_due_at`: next automatic scan time after interval and backoff

## Debugging failed sources

1. Run a single source locally:

```bash
cd backend
.venv/bin/python -m app.services.scanner --city Breda --source funda
```

2. Inspect recent scan history:

```bash
cd backend
sqlite3 rental_radar_pro.db "select source_id,status,scraped_count,created_count,updated_count,skipped_count,duplicate_count,duration_ms,error,finished_at from scan_history order by finished_at desc limit 20;"
```

3. Review the saved browser HTML under `backend/debug/` when a source looks blocked or empty.

4. Compare current stored listings for one source:

```bash
cd backend
sqlite3 rental_radar_pro.db "select source_key,title,url,last_seen_at,is_active from listings where source_key='funda' order by last_seen_at desc limit 20;"
```

Scan history is stored in the `scan_history` table. A quick local SQLite check:

```bash
cd backend
sqlite3 rental_radar_pro.db "select source_id,status,scraped_count,created_count,updated_count,finished_at from scan_history order by finished_at desc limit 10;"
```

Confirm recent listing inserts/updates:

```bash
cd backend
sqlite3 rental_radar_pro.db "select source_key,source,title,first_seen_at,last_checked_at from listings order by first_seen_at desc limit 10;"
```

## Post-deploy repair scripts

After deploying a build that includes `backend/scripts`, run these from the VPS:

Dry run first:

```bash
cd /home/rentscout/RentalRadarPro
docker compose exec -T backend python scripts/reclassify_listings.py
docker compose exec -T backend python scripts/repair_listing_locations.py
```

Apply only after reviewing the dry-run output:

```bash
cd /home/rentscout/RentalRadarPro
docker compose exec -T backend python scripts/reclassify_listings.py --apply
docker compose exec -T backend python scripts/repair_listing_locations.py --apply
```

`repair_listing_locations.py` is conservative by design:

- it trusts stored precise address text and URL city slugs before titles
- it never scans the full description as a rewrite signal
- it only writes city-level fallback coordinates when the target city is reliable
- if a row looks like a bad Breda fallback but the real city is still uncertain, it clears low-precision location data instead of inventing a new city
