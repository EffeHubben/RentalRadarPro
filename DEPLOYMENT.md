# RentalRadarPro Deployment Guide

This project is prepared for Docker-based deployment, but it is not deployed yet. The current setup keeps SQLite support for now and stores the Docker database in a persistent volume.

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
- `FRONTEND_ORIGIN`: Public frontend origin, for example `https://rentalradarpro.nl`.
- `BACKEND_CORS_ORIGINS`: Comma-separated allowed frontend origins.

Frontend:

- `NEXT_PUBLIC_API_BASE_URL`: Public backend API URL, for example `https://api.rentalradarpro.nl`.

Use `backend/.env.example` and `frontend/.env.local.example` as safe templates. Never commit real `.env` files.

## VPS Deployment Steps

1. Provision a VPS and install Docker Engine with the Docker Compose plugin.
2. Create a non-root deployment user and clone the repository.
3. Copy the example env files to real env files or set variables through your host/deployment tool.
4. Replace every placeholder secret before building.
5. Set production URLs:

```bash
FRONTEND_ORIGIN=https://rentalradarpro.nl
BACKEND_CORS_ORIGINS=https://rentalradarpro.nl
NEXT_PUBLIC_API_BASE_URL=https://api.rentalradarpro.nl
REFRESH_COOKIE_SECURE=true
```

6. Build and start:

```bash
docker compose up -d --build
```

7. Put a reverse proxy in front of the containers and enable HTTPS.

## Reverse Proxy

Recommended domain layout:

- `rentalradarpro.nl` routes to the frontend container on port `3000`.
- `api.rentalradarpro.nl` routes to the backend container on port `8000`.

Caddy example:

```caddy
rentalradarpro.nl {
    reverse_proxy 127.0.0.1:3000
}

api.rentalradarpro.nl {
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
docker cp backend/rental_radar_pro.db rentalradarpro-backend-1:/data/rental_radar_pro.db
docker compose restart backend
```

The exact container name can differ. Check it with:

```bash
docker compose ps
```

Do not commit the real database. It may contain user accounts, refresh tokens, scraped data, and local state. Keep backups outside Git.

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
```

Restart one service:

```bash
docker compose restart backend
docker compose restart frontend
```

## Future PostgreSQL Recommendation

SQLite is fine for a simple first deployment, but PostgreSQL is recommended once the app has real users, concurrent writes, backups, and operational monitoring. A future migration should add a PostgreSQL service, update `DATABASE_URL`, remove SQLite-only connection options, and include a tested data migration plan.
