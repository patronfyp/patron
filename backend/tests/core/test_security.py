"""Tests for the security headers, CORS and the SECRET_KEY check (audit 2026-11-28)."""

import pytest
from httpx import AsyncClient
from pydantic import ValidationError

from app.core.config import PLACEHOLDER_SECRET_KEY, Settings

DATABASE_URL = "postgresql+asyncpg://u:p@localhost/db"


def _settings(secret_key: str) -> Settings:
    return Settings(secret_key=secret_key, database_url=DATABASE_URL)


async def test_every_response_has_the_security_headers(client: AsyncClient) -> None:
    for response in (
        await client.get("/health"),
        await client.get("/api/v1/auth/me"),  # a 401 too
        await client.get("/api/v1/people", params={"q": "x"}),  # and a 422
    ):
        headers = response.headers
        assert headers["x-content-type-options"] == "nosniff"
        assert headers["x-frame-options"] == "DENY"
        assert "max-age=" in headers["strict-transport-security"]
        assert headers["referrer-policy"] == "no-referrer"
        assert "geolocation=()" in headers["permissions-policy"]


async def test_the_api_cannot_load_or_be_framed(client: AsyncClient) -> None:
    csp = (await client.get("/health")).headers["content-security-policy"]

    assert "default-src 'none'" in csp
    assert "frame-ancestors 'none'" in csp


async def test_the_docs_page_may_load_its_own_scripts(client: AsyncClient) -> None:
    csp = (await client.get("/docs")).headers["content-security-policy"]

    assert "script-src" in csp
    assert "frame-ancestors 'none'" in csp


async def test_cors_allows_only_the_frontend_methods_and_headers(client: AsyncClient) -> None:
    ask = await client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )
    odd_method = await client.options(
        "/api/v1/auth/login",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "TRACE"},
    )
    odd_header = await client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "x-evil",
        },
    )

    assert ask.status_code == 200
    assert "POST" in ask.headers["access-control-allow-methods"]
    assert "*" not in ask.headers["access-control-allow-methods"]
    assert odd_method.status_code == 400
    assert odd_header.status_code == 400


async def test_another_site_gets_no_cors_headers(client: AsyncClient) -> None:
    response = await client.get("/health", headers={"Origin": "https://evil.example"})

    assert "access-control-allow-origin" not in response.headers


def test_a_short_secret_key_is_refused() -> None:
    with pytest.raises(ValidationError, match="at least 32 characters"):
        _settings("short-key")


def test_the_placeholder_secret_key_is_refused() -> None:
    with pytest.raises(ValidationError, match="placeholder"):
        _settings(PLACEHOLDER_SECRET_KEY)


def test_a_generated_secret_key_is_accepted() -> None:
    assert _settings("x" * 32).secret_key == "x" * 32
