from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "RentalRadarPro"
    database_url: str = "sqlite:///./rental_radar_pro.db"
    max_rent: int = 1000
    default_city: str = "Breda"
    auth_secret_key: str = "change-me-in-production-rental-radar-pro"
    auth_access_token_minutes: int = 15
    auth_refresh_token_days: int = 30
    auth_refresh_cookie_name: str = "rental_radar_refresh_token"
    auth_cookie_secure: bool = False

    class Config:
        env_file = ".env"


settings = Settings()
