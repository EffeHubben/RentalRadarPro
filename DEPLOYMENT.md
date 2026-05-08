# RentScout Deployment Guide

This project is prepared for Docker-based deployment. The current setup keeps SQLite support for now and stores the Docker database in a persistent volume.

## Local Docker Run

From the project root:

```bash
docker compose up -d --build
```

Then open:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Backend health: http://localhost:8000/health

Stop the stack with:

```bash
docker compose down
```

Do not add `-v` unless you intentionally want to delete the persistent SQLite volume.

## Required Environment Variables

Backend:

- `DATABASE_URL`: SQLite URL. For Docker, use `sqlite:////data/rental_radar_pro.db`.
- `JWT_SECRET_KEY`: Long random secret used to sign auth tokens.
- `REFRESH_COOKIE_SECURE`: Use `false` locally, `true` behind HTTPS in production.
- `REFRESH_COOKIE_SAMESITE`: Use `lax` for same-site frontend/backend setups. Cross-site setups may need `none` with HTTPS.
- `FRONTEND_ORIGIN`: Public frontend origin, for example `https://rentscout.nl`.
- `BACKEND_CORS_ORIGINS`: Comma-separated allowed frontend origins.
- `LISTING_SCAN_INTERVAL_MINUTES`: Default automatic source scan interval. Use `5` for production.
- `LISTING_SOURCE_TIMEOUT_SECONDS`: Per-source scan timeout. Default is `45`.

Frontend:

- `NEXT_PUBLIC_API_URL`: Public backend API root including `/api`, for example `https://api.rentscout.nl/api`.

Scanner worker:

- Uses the same backend environment variables and database volume as the backend.
- Runs server-side only with `python -m app.services.scanner --city Breda --continuous --sleep-seconds 300`.
- The frontend should not trigger scraping; it reads stored listings and source status from the backend API.

Use `.env.example`, `backend/.env.example`, and `frontend/.env.local.example` as safe templates. Never commit real `.env` files.

## VPS Deployment Steps

1. Provision a VPS and install Docker Engine with the Docker Compose plugin.
2. Create a non-root deployment user and clone the repository.
3. Copy the example env files to real env files or set variables through your host/deployment tool.
4. Replace every placeholder secret before building.
5. Set production URLs. For an IP-based VPS deployment:

```bash
FRONTEND_ORIGIN=http://YOUR_SERVER_IP:3000
BACKEND_CORS_ORIGINS=http://YOUR_SERVER_IP:3000
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP:8000/api
REFRESH_COOKIE_SECURE=false
```

For a future HTTPS domain deployment:

```bash
FRONTEND_ORIGIN=https://rentscout.nl
BACKEND_CORS_ORIGINS=https://rentscout.nl,https://www.rentscout.nl
NEXT_PUBLIC_API_URL=https://api.rentscout.nl/api
REFRESH_COOKIE_SECURE=true
```

`docker-compose.yml` reads these values from the shell or a local Compose `.env` file in the project root. `NEXT_PUBLIC_API_URL` must be present before `docker compose up -d --build`, because Next.js embeds `NEXT_PUBLIC_*` values into the browser bundle during `next build`. Do not put this only in `frontend/.env.production` when building through Docker Compose.

For `rentscout.nl`, the project-root `.env` on the VPS should include:

```bash
NEXT_PUBLIC_API_URL=https://api.rentscout.nl/api
FRONTEND_ORIGIN=https://rentscout.nl
BACKEND_CORS_ORIGINS=https://rentscout.nl,https://www.rentscout.nl
REFRESH_COOKIE_SECURE=true
LISTING_SCAN_INTERVAL_MINUTES=5
```

6. Build and start:

```bash
docker compose up -d --build
```

7. Start the server-side scanner worker:

```bash
docker compose up -d scanner
docker compose logs -f scanner
```

Stop only the scanner worker:

```bash
docker compose stop scanner
```

8. Put a reverse proxy in front of the containers and enable HTTPS.

## Reverse Proxy

Recommended domain layout:

- `rentscout.nl` routes to the frontend container on port `3000`.
- `api.rentscout.nl` routes to the backend container on port `8000`.

Caddy example:

```caddy
rentscout.nl {
    reverse_proxy 127.0.0.1:3000
}

api.rentscout.nl {
    reverse_proxy 127.0.0.1:8000
}
```

Nginx can do the same with two `server` blocks, each using `proxy_pass` to the matching local port. Configure HTTPS certificates before using secure cookies in production.

## SQLite Database

Docker stores SQLite in the `backend_data` volume at:

```text
/data/rental_radar_pro.db
```

To initialize a fresh database, start the backend. The app creates its tables on startup.

To copy an existing local database into the Docker volume:

```bash
docker compose up -d backend
docker cp backend/rental_radar_pro.db "$(docker compose ps -q backend)":/data/rental_radar_pro.db
docker compose restart backend
```

The exact container name can differ. Check it with:

```bash
docker compose ps
```

Do not commit the real database. It may contain user accounts, refresh tokens, scraped data, and local state. Keep backups outside Git.

Before the first production deploy that enables the scanner worker, back up the SQLite database from the `backend_data` volume. The backend and scanner share the same SQLite file; SQLite busy timeout and WAL mode are configured by the backend database engine to reduce lock contention, but backups remain required before schema or worker changes.

## Secrets

Keep production secrets in VPS environment files, your deployment platform, or a secrets manager. Do not paste real secrets into:

- Git commits
- Dockerfiles
- `docker-compose.yml`
- Documentation
- Screenshots or logs

Generate a strong `JWT_SECRET_KEY`, for example with:

```bash
openssl rand -hex 32
```

## Restarting And Updating

After pulling new code on the VPS:

```bash
git pull
docker compose up -d --build
docker compose ps
```

View logs:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f scanner
```

Restart one service:

```bash
docker compose restart backend
docker compose restart frontend
docker compose restart scanner
```

## GitHub Actions Auto-Deploy

The repository can deploy automatically to the VPS whenever code is pushed to the `animated-landing-page` branch. The workflow lives at `.github/workflows/deploy.yml` and runs the same production update steps already used for manual deploys over SSH.

Add these GitHub repository secrets before enabling the workflow:

- `VPS_HOST`: VPS hostname or IP address.
- `VPS_USER`: SSH user used for deployments.
- `VPS_SSH_KEY`: Private SSH key for that deploy user.
- `VPS_PROJECT_PATH`: Absolute VPS path to the cloned project, for example `~/RentalRadarPro`.

On each push to `animated-landing-page`, GitHub Actions:

- connects to the VPS over SSH
- changes into `VPS_PROJECT_PATH`
- fetches and checks out `animated-landing-page`
- pulls the latest code from `origin`
- runs `docker compose up -d --build`
- runs `docker compose ps`
- calls `http://127.0.0.1:8000/health` if `curl` is available on the VPS

If auto-deploy fails or you need to deploy manually, use:

```bash
cd ~/RentalRadarPro
git fetch origin
git checkout animated-landing-page
git pull origin animated-landing-page
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:8000/health
```

## Registration Bot Protection

The current registration flow does not ship with captcha enforcement yet. For this stack, Cloudflare Turnstile is the cleanest next step because it is low-friction on mobile, works well behind a reverse proxy, and has a simple server-side verification API.

Recommended rollout:

- Frontend env: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- Backend env: `TURNSTILE_SECRET_KEY`
- Optional backend flag: `TURNSTILE_REQUIRED=true` in production

Suggested implementation shape:

1. Render the Turnstile widget only on the register mode of the auth modal.
2. Submit the Turnstile token with `POST /api/auth/register`.
3. Verify that token server-side before creating the user.
4. If the Turnstile env vars are missing, keep registration available in local development and log that captcha verification is skipped.
5. Enforce captcha in production only when the secret key is configured.

This change keeps the current auth surface scoped to branding and password hardening, instead of adding a partial captcha path without end-to-end verification.

## Future PostgreSQL Recommendation

SQLite is fine for a simple first deployment, but PostgreSQL is recommended once the app has real users, concurrent writes, backups, and operational monitoring. A future migration should add a PostgreSQL service, update `DATABASE_URL`, remove SQLite-only connection options, and include a tested data migration plan.
