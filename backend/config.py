"""Application configuration.

Single source of truth for settings. Nothing else in the codebase should read
`os.environ` directly - import `get_settings()` instead.
"""

from functools import lru_cache

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

    # Comma-separated in `.env`; read it through `cors_origin_list`.
    cors_origins: str = "http://localhost:5173"

    # These two deliberately have no defaults, so a missing `.env` fails loudly
    # at startup instead of silently using a well-known key or database.
    secret_key: str
    database_url: str

    # Module 1.13 - short-lived access token, longer-lived refresh token.
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Module 1.1 - LinkedIn OAuth (#25). Empty defaults rather than no
    # default: unlike secret_key/database_url, every other route works fine
    # without these, so a dev not touching this feature shouldn't have their
    # whole API refuse to start over it.
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""
    linkedin_redirect_uri: str = ""

    # Where the browser is sent after /auth/linkedin/callback finishes - the
    # frontend's own origin, not this API's.
    frontend_url: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached so `.env` is parsed once per process."""
    return Settings()
