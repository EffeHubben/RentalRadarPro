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
- `AUTH_REFRESH_COOKIE_PATH`: Refresh cookie path. Keep `/api/auth` unless auth endpoints move.
- `FRONTEND_ORIGIN`: Public frontend origin, for example `https://rentscout.nl`.
- `BACKEND_CORS_ORIGINS`: Comma-separated allowed frontend origins. Do not use `*`; credentialed auth requests require explicit origins.
- `LISTING_SCAN_INTERVAL_MINUTES`: Default automatic source scan interval. Use `5` for production.
- `LISTING_SOURCE_TIMEOUT_SECONDS`: Per-source scan timeout. Default is `45`.
- `RESEND_API_KEY`: Resend API key for transactional email sending.
- `EMAIL_FROM`: Verified sender address for RentScout emails.
- `APP_PUBLIC_URL`: Public frontend base URL used in email buttons and account links.
- `EMAIL_VERIFICATION_ENABLED`: Soft rollout flag for verification emails. Default `false`.
- `EMAIL_VERIFICATION_TOKEN_EXPIRATION_MINUTES`: Verification link lifetime. Default `4320`.
- `PASSWORD_RESET_ENABLED`: Enables password reset flow. Default `true`.
- `PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES`: Password reset link lifetime. Default `60`.

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
AUTH_REFRESH_COOKIE_PATH=/api/auth
```

For a future HTTPS domain deployment:

```bash
FRONTEND_ORIGIN=https://rentscout.nl
BACKEND_CORS_ORIGINS=https://rentscout.nl,https://www.rentscout.nl
NEXT_PUBLIC_API_URL=https://api.rentscout.nl/api
REFRESH_COOKIE_SECURE=true
AUTH_REFRESH_COOKIE_PATH=/api/auth
```

`docker-compose.yml` reads these values from the shell or a local Compose `.env` file in the project root. `NEXT_PUBLIC_API_URL` must be present before `docker compose up -d --build`, because Next.js embeds `NEXT_PUBLIC_*` values into the browser bundle during `next build`. Do not put this only in `frontend/.env.production` when building through Docker Compose.

For `rentscout.nl`, the project-root `.env` on the VPS should include:

```bash
NEXT_PUBLIC_API_URL=https://api.rentscout.nl/api
FRONTEND_ORIGIN=https://rentscout.nl
BACKEND_CORS_ORIGINS=https://rentscout.nl,https://www.rentscout.nl
REFRESH_COOKIE_SECURE=true
REFRESH_COOKIE_SAMESITE=lax
AUTH_REFRESH_COOKIE_PATH=/api/auth
LISTING_SCAN_INTERVAL_MINUTES=5
```

Refresh tokens are stored only in an HttpOnly cookie scoped to `/api/auth`, which is narrow enough for refresh/logout while still allowing login/register to set the cookie. The access token is returned in JSON and kept client-side in memory by the frontend auth provider.

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

## Post-Deploy Smoke Test

After a production deploy, run the smoke test script from the repository root:

```bash
bash scripts/smoke-test.sh
```

By default it checks:

- `https://rentscout.nl`
- `https://rentscout.nl/privacy`
- `https://rentscout.nl/terms`
- `https://rentscout.nl/contact`
- `https://api.rentscout.nl/health`
- `https://api.rentscout.nl/api/billing/config`
- `https://api.rentscout.nl/api/listings/?limit=1`

You can override the base URLs if needed:

```bash
WEB_BASE_URL=https://rentscout.nl API_BASE_URL=https://api.rentscout.nl bash scripts/smoke-test.sh
```

The script prints a pass/fail line for each endpoint and exits non-zero if any check fails.

## Registration Bot Protection

Registration now supports Cloudflare Turnstile in a feature-flagged way.

Environment variables:

- Frontend env: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- Backend env: `TURNSTILE_SECRET_KEY`
- Backend flag: `TURNSTILE_REQUIRED=false` by default

Current behavior:

1. The Turnstile widget is rendered only in register mode of the auth modal when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set.
2. The register request sends the Turnstile token to `POST /api/auth/register`.
3. If `TURNSTILE_SECRET_KEY` is configured and a token is provided, the backend verifies it with Cloudflare before creating the account.
4. If `TURNSTILE_REQUIRED=true`, registration is blocked unless a valid Turnstile token is present.
5. If the Turnstile keys are missing and `TURNSTILE_REQUIRED=false`, local development still works and registration continues without captcha enforcement.

Recommended production setup:

- Set both `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`
- Flip `TURNSTILE_REQUIRED=true` only after confirming the widget renders correctly on the live frontend

## Transactional Email Preview

Render local HTML previews without sending real emails:

```bash
cd backend
./.venv/bin/python scripts/preview_emails.py
```

Generated previews are written to:

```text
backend/tmp/email-previews/
```

Each preview includes both HTML and plain-text output for English and Dutch variants.

## Manual Email Test

To send a manual test welcome email from the backend environment, make sure `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_PUBLIC_URL` are already set in the active backend environment, then run:

```bash
cd backend
./.venv/bin/python -c "from app.services.email import EmailUserContext, send_welcome_email; send_welcome_email(EmailUserContext(id=999, email='your-email@example.com', display_name='Test User', preferred_language='en'), event_key='manual-test-welcome')"
```

To send a Dutch test email, change `preferred_language='nl'` and use a different `event_key`.

## Email Verification And Password Reset

RentScout now supports:

- branded multilingual welcome, billing, verification, and password reset emails
- soft email verification with hashed tokens stored server-side
- password reset request and confirmation endpoints with hashed expiring tokens

The rollout stays soft by default:

- email verification is available but not enforced for login
- verification mail sending is controlled by `EMAIL_VERIFICATION_ENABLED`
- password reset always returns a generic success message to avoid account enumeration
- missing Resend config logs and skips sending instead of breaking auth flows

## Future PostgreSQL Recommendation

SQLite is fine for a simple first deployment, but PostgreSQL is recommended once the app has real users, concurrent writes, backups, and operational monitoring. A future migration should add a PostgreSQL service, update `DATABASE_URL`, remove SQLite-only connection options, and include a tested data migration plan.
