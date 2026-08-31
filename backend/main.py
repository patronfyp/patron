"""Patron API - application entry point.

Minimal scaffold: configuration, CORS and a health check. No feature routes yet.

Run locally:
    uv run uvicorn main:app --reload
"""

from functools import lru_cache

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings read from environment variables, falling back to `.env`.

    Names are matched case-insensitively, so `APP_NAME` in `.env` fills
    `app_name` here.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Patron API"
    app_env: str = "development"
    debug: bool = False

    api_v1_prefix: str = "/api/v1"

    # Comma-separated in .env; read it through `cors_origin_list`.
    cors_origins: str = "http://localhost:5173"

    # Deliberately has no default: the app should refuse to start rather than
    # silently sign tokens with a well-known key.
    secret_key: str

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached so `.env` is parsed once per process."""
    return Settings()


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Vouched, Verified, Hired.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    """Liveness check - used by the frontend and by deployment health probes."""
    return {"status": "ok", "env": settings.app_env}
