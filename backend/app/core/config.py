from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://rentscout.nl",
    "https://www.rentscout.nl",
]


def normalize_origin(origin: str) -> str:
    return origin.strip().rstrip("/")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    app_name: str = "RentScout"
    database_url: str = "sqlite:///./rental_radar_pro.db"
    max_rent: int = 1000
    default_city: str = "Breda"
    listing_scan_cities: str = (
        "Amsterdam,Rotterdam,Den Haag,Utrecht,Eindhoven,Tilburg,Breda,"
        "Den Bosch,Nijmegen,Arnhem,Groningen,Maastricht,Leiden,Delft,"
        "Haarlem,Almere,Amersfoort,Apeldoorn,Enschede,Zwolle,Dordrecht,"
        "Zoetermeer,Etten-Leur,Roosendaal,Bergen op Zoom"
    )
    listing_scan_max_cities_per_cycle: int = 6
    listing_scan_per_city_pause_seconds: int = 8
    auth_secret_key: str = "change-me-in-production-rental-radar-pro"
    jwt_secret_key: str | None = None
    auth_access_token_minutes: int = 15
    auth_refresh_token_days: int = 30
    auth_refresh_cookie_name: str = "rental_radar_refresh_token"
    auth_refresh_cookie_path: str = "/api/auth"
    auth_cookie_secure: bool = False
    refresh_cookie_secure: bool | None = None
    refresh_cookie_samesite: str = "lax"
    frontend_origin: str = "http://localhost:3000"
    backend_cors_origins: str = ",".join(DEFAULT_CORS_ORIGINS)
    listing_scan_interval_minutes: int = 5
    listing_source_timeout_seconds: int = 45
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_price_id_pro: str | None = None
    billing_success_url: str | None = None
    billing_cancel_url: str | None = None
    resend_api_key: str | None = None
    email_from: str | None = None
    app_public_url: str | None = None
    email_verification_enabled: bool = False
    email_verification_token_expiration_minutes: int = 4320
    password_reset_enabled: bool = True
    password_reset_token_expiration_minutes: int = 60
    turnstile_secret_key: str | None = None
    turnstile_required: bool = False

    @property
    def token_secret_key(self) -> str:
        return self.jwt_secret_key or self.auth_secret_key

    @property
    def refresh_cookie_secure_enabled(self) -> bool:
        return self.refresh_cookie_secure if self.refresh_cookie_secure is not None else self.auth_cookie_secure

    @property
    def scan_cities(self) -> list[str]:
        cities: list[str] = []
        seen: set[str] = set()
        for raw in (self.listing_scan_cities or "").split(","):
            normalized = " ".join(raw.split())
            if not normalized:
                continue
            key = normalized.lower()
            if key in seen:
                continue
            seen.add(key)
            cities.append(normalized)
        if not cities:
            cities.append(self.default_city)
        return cities

    @property
    def cors_origins(self) -> list[str]:
        origins = []

        for origin in [
            *DEFAULT_CORS_ORIGINS,
            *self.backend_cors_origins.split(","),
            self.frontend_origin,
        ]:
            normalized_origin = normalize_origin(origin)

            if normalized_origin == "*":
                continue

            if normalized_origin and normalized_origin not in origins:
                origins.append(normalized_origin)

        return origins

settings = Settings()
