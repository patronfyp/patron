"""Tests for POST /api/v1/auth/login and POST /api/v1/auth/refresh."""

import uuid
from datetime import UTC, datetime, timedelta

import jwt
from httpx import AsyncClient

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.modules.auth.models import User

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
REFRESH_URL = "/api/v1/auth/refresh"

_EMAIL = "login@test.com"
_PASSWORD = "secret123"


async def _register(client: AsyncClient) -> str:
    """Register the test user and return their id."""
    response = await client.post(
        REGISTER_URL,
        json={
            "email": _EMAIL,
            "password": _PASSWORD,
            "full_name": "Login Test",
            "role": "candidate",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def _expired_token(user_id: str, token_type: str) -> str:
    """Builds a token whose `exp` is already in the past - PyJWT rejects it
    on decode regardless of what created it."""
    settings = get_settings()
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "iat": datetime.now(UTC) - timedelta(hours=1),
        "exp": datetime.now(UTC) - timedelta(minutes=1),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


class TestLogin:
    async def test_valid_login_returns_both_tokens(
        self, client: AsyncClient, clean_users_table: None
    ) -> None:
        await _register(client)

        response = await client.post(LOGIN_URL, json={"email": _EMAIL, "password": _PASSWORD})

        assert response.status_code == 200
        body = response.json()
        assert body["access_token"]
        assert body["refresh_token"]
        assert body["token_type"] == "bearer"

    async def test_login_is_case_insensitive_on_email(
        self, client: AsyncClient, clean_users_table: None
    ) -> None:
        await _register(client)

        response = await client.post(
            LOGIN_URL, json={"email": "LOGIN@TEST.COM", "password": _PASSWORD}
        )

        assert response.status_code == 200

    async def test_wrong_password_is_rejected(
        self, client: AsyncClient, clean_users_table: None
    ) -> None:
        await _register(client)

        response = await client.post(LOGIN_URL, json={"email": _EMAIL, "password": "wrong-one"})

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password"

    async def test_unknown_email_is_rejected(
        self, client: AsyncClient, clean_users_table: None
    ) -> None:
        response = await client.post(LOGIN_URL, json={"email": "nobody@test.com", "password": "x"})

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password"

    async def test_wrong_password_and_unknown_email_give_the_identical_message(
        self, client: AsyncClient, clean_users_table: None
    ) -> None:
        """STANDARDS.md §6, rule 10 - confirming which one was wrong tells an
        attacker whether an account exists for that email."""
        await _register(client)

        wrong_password = await client.post(LOGIN_URL, json={"email": _EMAIL, "password": "wrong"})
        unknown_email = await client.post(
            LOGIN_URL, json={"email": "nobody@test.com", "password": "x"}
        )

        assert wrong_password.json()["detail"] == unknown_email.json()["detail"]
        assert wrong_password.status_code == unknown_email.status_code == 401

    async def test_a_user_with_no_password_gets_a_clean_401(
        self, client: AsyncClient, clean_users_table: None
    ) -> None:
        """A future LinkedIn-only account (Module 1.1) has password=None.
        Attempting password login against it must not crash."""
        async with SessionLocal() as session:
            session.add(User(email="oauth-only@test.com", full_name="OAuth Only"))
            await session.commit()

        response = await client.post(
            LOGIN_URL, json={"email": "oauth-only@test.com", "password": "anything"}
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password"


class TestRefresh:
    async def test_refresh_returns_a_new_access_token(
        self, client: AsyncClient, clean_users_table: None
    ) -> None:
        user_id = await _register(client)
        login = await client.post(LOGIN_URL, json={"email": _EMAIL, "password": _PASSWORD})
        refresh_token = login.json()["refresh_token"]

        response = await client.post(REFRESH_URL, json={"refresh_token": refresh_token})

        assert response.status_code == 200
        new_access_token = response.json()["access_token"]
        assert new_access_token

        # Decoded, not compared: two tokens from the same second are identical.
        settings = get_settings()
        payload = jwt.decode(new_access_token, settings.secret_key, algorithms=["HS256"])
        assert payload["type"] == "access"
        assert payload["sub"] == user_id

    async def test_an_access_token_is_rejected_at_the_refresh_endpoint(
        self, client: AsyncClient, clean_users_table: None
    ) -> None:
        """The token-type check is the whole point of #15's design - without
        it, a leaked access token could mint new access tokens forever."""
        await _register(client)
        login = await client.post(LOGIN_URL, json={"email": _EMAIL, "password": _PASSWORD})
        access_token = login.json()["access_token"]

        response = await client.post(REFRESH_URL, json={"refresh_token": access_token})

        assert response.status_code == 401

    async def test_an_expired_refresh_token_is_rejected(
        self, client: AsyncClient, clean_users_table: None
    ) -> None:
        user_id = await _register(client)
        expired = _expired_token(user_id=user_id, token_type="refresh")

        response = await client.post(REFRESH_URL, json={"refresh_token": expired})

        assert response.status_code == 401

    async def test_a_refresh_token_whose_subject_is_not_a_uuid_is_rejected(
        self, client: AsyncClient
    ) -> None:
        """A token from before ids became UUIDs carries `sub: "1"`. It must be
        a clean 401, not a 500 from failing to parse the id."""
        settings = get_settings()
        old_style = jwt.encode(
            {
                "sub": "1",
                "type": "refresh",
                "iat": datetime.now(UTC),
                "exp": datetime.now(UTC) + timedelta(days=1),
            },
            settings.secret_key,
            algorithm="HS256",
        )

        response = await client.post(REFRESH_URL, json={"refresh_token": old_style})

        assert response.status_code == 401

    async def test_a_refresh_token_for_an_unknown_user_is_rejected(
        self, client: AsyncClient, clean_users_table: None
    ) -> None:
        settings = get_settings()
        token = jwt.encode(
            {
                "sub": str(uuid.uuid4()),
                "type": "refresh",
                "iat": datetime.now(UTC),
                "exp": datetime.now(UTC) + timedelta(days=1),
            },
            settings.secret_key,
            algorithm="HS256",
        )

        response = await client.post(REFRESH_URL, json={"refresh_token": token})

        assert response.status_code == 401

    async def test_a_tampered_refresh_token_is_rejected(
        self, client: AsyncClient, clean_users_table: None
    ) -> None:
        await _register(client)
        login = await client.post(LOGIN_URL, json={"email": _EMAIL, "password": _PASSWORD})
        tampered = login.json()["refresh_token"][:-1] + (
            "x" if login.json()["refresh_token"][-1] != "x" else "y"
        )

        response = await client.post(REFRESH_URL, json={"refresh_token": tampered})

        assert response.status_code == 401

    async def test_garbage_input_is_rejected(
        self, client: AsyncClient, clean_users_table: None
    ) -> None:
        response = await client.post(REFRESH_URL, json={"refresh_token": "not-a-jwt-at-all"})

        assert response.status_code == 401

    async def test_refresh_for_a_deactivated_user_is_rejected(
        self, client: AsyncClient, clean_users_table: None
    ) -> None:
        """A refresh token outlives a single request - it must be checked
        against current account state, not just trusted as of login time."""
        user_id = await _register(client)
        login = await client.post(LOGIN_URL, json={"email": _EMAIL, "password": _PASSWORD})
        refresh_token = login.json()["refresh_token"]

        async with SessionLocal() as session:
            user = await session.get(User, uuid.UUID(user_id))
            user.is_active = False
            await session.commit()

        response = await client.post(REFRESH_URL, json={"refresh_token": refresh_token})

        assert response.status_code == 401
