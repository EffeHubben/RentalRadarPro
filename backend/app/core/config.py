from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "RentScout"
    database_url: str = "sqlite:///./rental_radar_pro.db"
    max_rent: int = 1000
    default_city: str = "Breda"
    auth_secret_key: str = "change-me-in-production-rental-radar-pro"
    jwt_secret_key: str | None = None
    auth_access_token_minutes: int = 15
    auth_refresh_token_days: int = 30
    auth_refresh_cookie_name: str = "rental_radar_refresh_token"
    auth_cookie_secure: bool = False
    refresh_cookie_secure: bool | None = None
    refresh_cookie_samesite: str = "lax"
    frontend_origin: str = "http://localhost:3000"
    backend_cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"

    @property
    def token_secret_key(self) -> str:
        return self.jwt_secret_key or self.auth_secret_key

    @property
    def refresh_cookie_secure_enabled(self) -> bool:
        return self.refresh_cookie_secure if self.refresh_cookie_secure is not None else self.auth_cookie_secure

    @property
    def cors_origins(self) -> list[str]:
        origins = [
            origin.strip()
            for origin in self.backend_cors_origins.split(",")
            if origin.strip()
        ]

        if self.frontend_origin and self.frontend_origin not in origins:
            origins.append(self.frontend_origin)

        return origins

    class Config:
        env_file = ".env"


settings = Settings()
