"""Tests for POST /api/v1/auth/password/change - Module 1.8."""

from datetime import UTC, datetime, timedelta

import jwt
from httpx import AsyncClient

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.modules.auth.models import User

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/auth/me"
CHANGE_URL = "/api/v1/auth/password/change"

_EMAIL = "change@example.com"
_OLD = "secret123"
_NEW = "brand-new-456"


async def _sign_in(client: AsyncClient) -> tuple[dict, str]:
    """Register and log in; return the auth header and the user id."""
    registered = await client.post(
        REGISTER_URL,
        json={"email": _EMAIL, "password": _OLD, "full_name": "Change", "role": "candidate"},
    )
    login = await client.post(LOGIN_URL, json={"email": _EMAIL, "password": _OLD})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}, registered.json()["id"]


def _change(current: str = _OLD, new: str = _NEW) -> dict:
    return {"current_password": current, "new_password": new}


def _token_issued_seconds_ago(user_id: str, seconds: int) -> str:
    """A token from before the change. `iat` has one-second resolution, so a
    real one from the same second would legitimately survive."""
    issued = datetime.now(UTC) - timedelta(seconds=seconds)
    payload = {"sub": user_id, "type": "access", "iat": issued, "exp": issued + timedelta(hours=1)}
    return jwt.encode(payload, get_settings().secret_key, algorithm="HS256")


async def test_it_requires_a_token(client: AsyncClient) -> None:
    assert (await client.post(CHANGE_URL, json=_change())).status_code == 401


async def test_the_new_password_works_and_the_old_one_does_not(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers, _ = await _sign_in(client)

    response = await client.post(CHANGE_URL, headers=headers, json=_change())

    assert response.status_code == 200
    old = await client.post(LOGIN_URL, json={"email": _EMAIL, "password": _OLD})
    new = await client.post(LOGIN_URL, json={"email": _EMAIL, "password": _NEW})
    assert old.status_code == 401
    assert new.status_code == 200


async def test_the_returned_tokens_keep_this_session_signed_in(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers, _ = await _sign_in(client)

    tokens = (await client.post(CHANGE_URL, headers=headers, json=_change())).json()

    me = await client.get(ME_URL, headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me.status_code == 200
    assert tokens["refresh_token"]


async def test_older_sessions_are_signed_out(client: AsyncClient, clean_users_table: None) -> None:
    headers, user_id = await _sign_in(client)
    older_session = _token_issued_seconds_ago(user_id, 10)

    await client.post(CHANGE_URL, headers=headers, json=_change())

    me = await client.get(ME_URL, headers={"Authorization": f"Bearer {older_session}"})
    assert me.status_code == 401


async def test_a_wrong_current_password_changes_nothing(
    client: AsyncClient, clean_users_table: None
) -> None:
    """400, not 401 - a 401 would make the frontend try to refresh the session."""
    headers, _ = await _sign_in(client)

    response = await client.post(CHANGE_URL, headers=headers, json=_change(current="wrong-one"))

    assert response.status_code == 400
    still_old = await client.post(LOGIN_URL, json={"email": _EMAIL, "password": _OLD})
    assert still_old.status_code == 200


async def test_the_new_password_must_differ(client: AsyncClient, clean_users_table: None) -> None:
    headers, _ = await _sign_in(client)

    response = await client.post(CHANGE_URL, headers=headers, json=_change(new=_OLD))

    assert response.status_code == 400


async def test_the_new_password_follows_the_registration_rules(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers, _ = await _sign_in(client)

    too_short = await client.post(CHANGE_URL, headers=headers, json=_change(new="short"))
    too_long = await client.post(CHANGE_URL, headers=headers, json=_change(new="x" * 73))

    assert too_short.status_code == 422
    assert too_long.status_code == 422


async def test_a_linkedin_only_account_is_sent_to_forgot_password(
    client: AsyncClient, clean_users_table: None
) -> None:
    async with SessionLocal() as session:
        user = User(email="li-only@example.com", full_name="LinkedIn Only", password=None)
        session.add(user)
        await session.commit()
        user_id = str(user.id)
    token = _token_issued_seconds_ago(user_id, 0)

    response = await client.post(
        CHANGE_URL, headers={"Authorization": f"Bearer {token}"}, json=_change()
    )

    assert response.status_code == 400
    assert "Forgot password" in response.json()["detail"]
