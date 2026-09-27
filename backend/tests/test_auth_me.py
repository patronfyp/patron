"""Tests for GET /api/v1/auth/me and the get_current_user dependency behind it.

These are the tests that matter most in the whole auth module: every future
protected endpoint in every module reuses get_current_user, so a bug here is
a bug everywhere at once.
"""

from datetime import UTC, datetime, timedelta

import jwt
from httpx import AsyncClient

from app.modules.auth.models import User
from config import get_settings
from db import SessionLocal

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/auth/me"

_EMAIL = "me-test@example.com"
_PASSWORD = "secret123"


async def _register_and_get_tokens(client: AsyncClient) -> dict:
    await client.post(
        REGISTER_URL,
        json={"email": _EMAIL, "password": _PASSWORD, "full_name": "Me Test", "role": "candidate"},
    )
    login = await client.post(LOGIN_URL, json={"email": _EMAIL, "password": _PASSWORD})
    return login.json()


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_me_requires_a_token(client: AsyncClient, clean_users_table: None) -> None:
    response = await client.get(ME_URL)

    assert response.status_code == 401


async def test_me_rejects_a_malformed_token(client: AsyncClient, clean_users_table: None) -> None:
    response = await client.get(ME_URL, headers=_auth_header("not-a-real-token"))

    assert response.status_code == 401


async def test_me_rejects_a_refresh_token_used_as_an_access_token(
    client: AsyncClient, clean_users_table: None
) -> None:
    """The type check from #15 works both directions - a refresh token is not
    a valid access token either, even though nothing in this issue's spec
    required checking that. It falls out of the design for free."""
    tokens = await _register_and_get_tokens(client)

    response = await client.get(ME_URL, headers=_auth_header(tokens["refresh_token"]))

    assert response.status_code == 401


async def test_me_rejects_an_expired_token(client: AsyncClient, clean_users_table: None) -> None:
    await _register_and_get_tokens(client)
    settings = get_settings()
    expired = jwt.encode(
        {
            "sub": "1",
            "type": "access",
            "iat": datetime.now(UTC) - timedelta(hours=1),
            "exp": datetime.now(UTC) - timedelta(minutes=1),
        },
        settings.secret_key,
        algorithm="HS256",
    )

    response = await client.get(ME_URL, headers=_auth_header(expired))

    assert response.status_code == 401


async def test_me_returns_the_signed_in_user(client: AsyncClient, clean_users_table: None) -> None:
    tokens = await _register_and_get_tokens(client)

    response = await client.get(ME_URL, headers=_auth_header(tokens["access_token"]))

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == _EMAIL
    assert body["full_name"] == "Me Test"
    assert "password" not in body


async def test_me_rejects_a_token_for_a_deactivated_user(
    client: AsyncClient, clean_users_table: None
) -> None:
    """A token issued before a ban must stop working immediately, not just
    once its own refresh token is used again - see Module 13.2."""
    tokens = await _register_and_get_tokens(client)

    async with SessionLocal() as session:
        user = await session.get(User, 1)
        user.is_active = False
        await session.commit()

    response = await client.get(ME_URL, headers=_auth_header(tokens["access_token"]))

    assert response.status_code == 401
