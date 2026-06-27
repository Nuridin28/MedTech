"""Application configuration (TZ §11 — secrets via env)."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    app_name: str = "MedServicePrice.kz API"
    environment: str = Field(default="development")
    debug: bool = Field(default=True)

    # --- Database ---
    postgres_user: str = "msp"
    postgres_password: str = "msp_password"
    postgres_host: str = "db"
    postgres_port: int = 5432
    postgres_db: str = "medserviceprice"

    # --- Redis ---
    redis_host: str = "redis"
    redis_port: int = 6379
    redis_db: int = 0

    # --- Security (TZ §11) ---
    admin_api_key: str = Field(default="change-me-in-prod")
    cors_origins: str = Field(default="http://localhost:5173,http://localhost")

    # --- Search ---
    # Semantic search is heavy (loads a multilingual transformer). Off by default so
    # the API container stays light; lexical (pg_trgm) always works, hybrid degrades
    # gracefully to lexical when this is false. Set true in the worker / when desired.
    enable_semantic: bool = Field(default=False)
    embedding_model: str = Field(default="paraphrase-multilingual-MiniLM-L12-v2")
    embedding_dim: int = 384

    # --- Parser (TZ §5.4) ---
    parser_user_agent: str = (
        "MedServicePriceBot/2.0 (+https://medserviceprice.kz; price aggregator; respects robots.txt)"
    )
    parser_delay_seconds: float = 1.5
    parser_max_retries: int = 3
    parser_timeout_seconds: float = 30.0
    fx_usd_kzt_fallback: float = 470.0

    # --- Cache TTLs (seconds, TZ §9) ---
    cache_ttl_autocomplete: int = 3600
    cache_ttl_offers: int = 600
    cache_ttl_clinic: int = 1800
    cache_ttl_fx: int = 86400

    # --- Data freshness (TZ §4) — offers older than this are "stale" ---
    stale_after_days: int = 30

    # --- File uploads (TZ §3.1) ---
    upload_dir: str = "/app/data/uploads"

    # --- Geocoding (TZ §3.4 map) — OSM Nominatim (public, no key) ---
    geocode_enabled: bool = True
    geocode_url: str = "https://nominatim.openstreetmap.org/search"

    # --- Places API (ratings/reviews/photos) — official, OFF by default ---
    # Reviews/ratings/photos must come from an official API, never scraped from
    # maps (ToS) — see clinic_enrich.py for the safe own-site enrichment path.
    places_provider: str = Field(default="none")  # 'none' | '2gis' | 'google'
    twogis_api_key: str = ""
    google_places_key: str = ""
    places_reviews_limit: int = 5

    # --- Email notifications (TZ §3.4) — optional; logs if SMTP_HOST unset ---
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "MedServicePrice.kz <noreply@medserviceprice.kz>"
    smtp_tls: bool = True

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def sync_database_url(self) -> str:
        """Used by Alembic and Celery (sync engines)."""
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
