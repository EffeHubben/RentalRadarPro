# RentScout scanner

Run these commands from the project root unless noted otherwise.

## One-off scans

Run all automatic sources once:

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
python -m app.services.scanner --city Breda --continuous --sleep-seconds 300
```

The worker uses the same Docker volume as the backend, so it writes listings and scan history to the same SQLite database. Back up the SQLite database before the first production deploy that enables the scanner worker.

## Logs and database checks

Scanner logs are written to stdout by the CLI and to the backend process logs when scans are triggered through the API. Each source writes `scan_start`, `scan_finished`, `scan_blocked`, or `scan_failed` log lines.

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
