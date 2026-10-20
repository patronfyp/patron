"""Settings - the only place env vars are read. Use `get_settings()`."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """From env vars, then `.env`. Case-insensitive: `APP_NAME` fills `app_name`."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Patron API"
    app_env: str = "development"
    debug: bool = False

    api_v1_prefix: str = "/api/v1"

    # Comma-separated in `.env`; read it through `cors_origin_list`.
    cors_origins: str = "http://localhost:5173"

    # No defaults: a missing `.env` must fail at startup, not use a known key.
    secret_key: str
    database_url: str

    # Module 1.13.
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # LinkedIn OAuth (Module 1.1). Empty by default so the rest of the API
    # still starts without them.
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""
    linkedin_redirect_uri: str = ""

    # The frontend origin LinkedIn's callback redirects back to.
    frontend_url: str = "http://localhost:5173"

    # "console" prints emails; "resend" sends them. See app/core/email.py.
    email_backend: Literal["console", "resend"] = "console"
    # Resend only allows this sender until our own domain is verified.
    email_from: str = "PATRON <onboarding@resend.dev>"
    resend_api_key: str = ""

    # Local upload folder, relative to backend/.
    upload_dir: str = "uploads"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached so `.env` is parsed once per process."""
    return Settings()
