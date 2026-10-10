"""Tests for POST /api/v1/auth/password-reset/request and /confirm - Module 1.12."""

import re
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.core.email import EmailDeliveryError, get_email_sender
from app.modules.auth.models import PasswordResetToken, User
from config import get_settings
from db import SessionLocal
from main import app

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
REFRESH_URL = "/api/v1/auth/refresh"
ME_URL = "/api/v1/auth/me"
REQUEST_URL = "/api/v1/auth/password-reset/request"
CONFIRM_URL = "/api/v1/auth/password-reset/confirm"

_EMAIL = "reset-test@example.com"
_OLD_PASSWORD = "oldpass123"
_NEW_PASSWORD = "newpass456"


class RecordingSender:
    """Stands in for the real sender and keeps every email it was given."""

    def __init__(self) -> None:
        self.sent: list[dict[str, str]] = []
        # Set to make the next send behave like the provider refusing it.
        self.fail_next = False

    async def send(self, to: str, subject: str, body: str) -> None:
        if self.fail_next:
            self.fail_next = False
            raise EmailDeliveryError("provider refused")
        self.sent.append({"to": to, "subject": subject, "body": body})

    def last_token(self) -> str:
        return re.search(r"reset-password\?token=(\S+)", self.sent[-1]["body"]).group(1)


@pytest.fixture
async def sender() -> AsyncIterator[RecordingSender]:
    recording = RecordingSender()
    app.dependency_overrides[get_email_sender] = lambda: recording
    yield recording
    app.dependency_overrides.pop(get_email_sender, None)


async def _register(client: AsyncClient) -> None:
    await client.post(
        REGISTER_URL,
        json={
            "email": _EMAIL,
            "password": _OLD_PASSWORD,
            "full_name": "Reset Test",
            "role": "candidate",
        },
    )


async def _login(client: AsyncClient, password: str) -> int:
    response = await client.post(LOGIN_URL, json={"email": _EMAIL, "password": password})
    return response.status_code


async def _token_rows() -> list[PasswordResetToken]:
    async with SessionLocal() as session:
        return list((await session.scalars(select(PasswordResetToken))).all())


def _token_issued_seconds_ago(user_id: int, kind: str, seconds: int) -> str:
    """A token like the ones login hands out, but issued in the past.

    `iat` has one-second resolution, so a token from a real login in the same
    second as the reset would legitimately survive it. Backdating makes the
    "issued before the reset" case certain instead of timing-dependent.
    """
    issued = datetime.now(UTC) - timedelta(seconds=seconds)
    payload = {
        "sub": str(user_id),
        "type": kind,
        "iat": issued,
        "exp": issued + timedelta(days=1),
    }
    return jwt.encode(payload, get_settings().secret_key, algorithm="HS256")


async def test_full_reset_flow(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    await _register(client)

    requested = await client.post(REQUEST_URL, json={"email": _EMAIL})
    confirmed = await client.post(
        CONFIRM_URL, json={"token": sender.last_token(), "new_password": _NEW_PASSWORD}
    )

    assert requested.status_code == 202
    assert sender.sent[-1]["to"] == _EMAIL
    assert f"{get_settings().frontend_url}/reset-password?token=" in sender.sent[-1]["body"]
    assert confirmed.status_code == 204
    assert await _login(client, _NEW_PASSWORD) == 200
    assert await _login(client, _OLD_PASSWORD) == 401


async def test_email_is_matched_case_insensitively(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    await _register(client)

    await client.post(REQUEST_URL, json={"email": _EMAIL.upper()})

    assert len(sender.sent) == 1


async def test_unknown_email_gets_the_same_202_and_no_email(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    await _register(client)

    known = await client.post(REQUEST_URL, json={"email": _EMAIL})
    unknown = await client.post(REQUEST_URL, json={"email": "nobody@example.com"})

    assert unknown.status_code == 202
    assert unknown.json() == known.json()
    assert [email["to"] for email in sender.sent] == [_EMAIL]


async def test_token_is_stored_hashed(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    await _register(client)
    await client.post(REQUEST_URL, json={"email": _EMAIL})

    rows = await _token_rows()

    assert len(rows) == 1
    assert rows[0].token_hash != sender.last_token()
    assert len(rows[0].token_hash) == 64  # a SHA-256 hex digest


async def test_unknown_token_is_rejected(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    response = await client.post(
        CONFIRM_URL, json={"token": "not-a-real-token", "new_password": _NEW_PASSWORD}
    )

    assert response.status_code == 400


async def test_expired_token_is_rejected(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    await _register(client)
    await client.post(REQUEST_URL, json={"email": _EMAIL})
    async with SessionLocal() as session:
        await session.execute(
            update(PasswordResetToken).values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
        await session.commit()

    response = await client.post(
        CONFIRM_URL, json={"token": sender.last_token(), "new_password": _NEW_PASSWORD}
    )

    assert response.status_code == 400
    assert await _login(client, _OLD_PASSWORD) == 200


async def test_token_works_only_once(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    await _register(client)
    await client.post(REQUEST_URL, json={"email": _EMAIL})
    token = sender.last_token()
    await client.post(CONFIRM_URL, json={"token": token, "new_password": _NEW_PASSWORD})

    again = await client.post(CONFIRM_URL, json={"token": token, "new_password": "third789x"})

    assert again.status_code == 400
    assert await _login(client, _NEW_PASSWORD) == 200


async def test_new_link_replaces_the_old_one(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    await _register(client)
    await client.post(REQUEST_URL, json={"email": _EMAIL})
    old_token = sender.last_token()
    # Push the first request outside the cooldown instead of waiting 60 seconds.
    async with SessionLocal() as session:
        await session.execute(
            update(PasswordResetToken).values(created_at=datetime.now(UTC) - timedelta(minutes=2))
        )
        await session.commit()
    await client.post(REQUEST_URL, json={"email": _EMAIL})
    new_token = sender.last_token()

    old = await client.post(CONFIRM_URL, json={"token": old_token, "new_password": _NEW_PASSWORD})
    new = await client.post(CONFIRM_URL, json={"token": new_token, "new_password": _NEW_PASSWORD})

    assert old.status_code == 400
    assert new.status_code == 204


async def test_requests_within_a_minute_send_only_one_email(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    await _register(client)

    first = await client.post(REQUEST_URL, json={"email": _EMAIL})
    second = await client.post(REQUEST_URL, json={"email": _EMAIL})

    # Still 202, not 429: a 429 would reveal that the account exists.
    assert first.status_code == 202
    assert second.status_code == 202
    assert len(sender.sent) == 1


async def test_provider_failure_still_returns_202_and_allows_a_retry(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    await _register(client)
    sender.fail_next = True

    failed = await client.post(REQUEST_URL, json={"email": _EMAIL})
    rows_after_failure = await _token_rows()
    retry = await client.post(REQUEST_URL, json={"email": _EMAIL})

    # A 503 would reveal that the account exists, so it stays 202.
    assert failed.status_code == 202
    assert rows_after_failure == []
    assert retry.status_code == 202
    assert len(sender.sent) == 1


async def test_new_password_must_meet_the_rules(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    await _register(client)
    await client.post(REQUEST_URL, json={"email": _EMAIL})
    token = sender.last_token()

    too_short = await client.post(CONFIRM_URL, json={"token": token, "new_password": "short"})
    too_long = await client.post(CONFIRM_URL, json={"token": token, "new_password": "x" * 73})

    assert too_short.status_code == 422
    assert too_long.status_code == 422
    # A rejected password must not use up the token.
    ok = await client.post(CONFIRM_URL, json={"token": token, "new_password": _NEW_PASSWORD})
    assert ok.status_code == 204


async def test_reset_signs_out_existing_sessions(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    await _register(client)
    async with SessionLocal() as session:
        user_id = (await session.scalar(select(User).where(User.email == _EMAIL))).id
    old_access = _token_issued_seconds_ago(user_id, "access", 10)
    old_refresh = _token_issued_seconds_ago(user_id, "refresh", 10)
    # Both work before the reset.
    assert (
        await client.get(ME_URL, headers={"Authorization": f"Bearer {old_access}"})
    ).status_code == 200
    assert (await client.post(REFRESH_URL, json={"refresh_token": old_refresh})).status_code == 200

    await client.post(REQUEST_URL, json={"email": _EMAIL})
    await client.post(
        CONFIRM_URL, json={"token": sender.last_token(), "new_password": _NEW_PASSWORD}
    )

    me = await client.get(ME_URL, headers={"Authorization": f"Bearer {old_access}"})
    refresh = await client.post(REFRESH_URL, json={"refresh_token": old_refresh})
    assert me.status_code == 401
    assert refresh.status_code == 401


async def test_login_right_after_a_reset_works(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    """The fresh session after a reset must not be caught by the revocation."""
    await _register(client)
    await client.post(REQUEST_URL, json={"email": _EMAIL})
    await client.post(
        CONFIRM_URL, json={"token": sender.last_token(), "new_password": _NEW_PASSWORD}
    )

    login = await client.post(LOGIN_URL, json={"email": _EMAIL, "password": _NEW_PASSWORD})
    tokens = login.json()
    me = await client.get(ME_URL, headers={"Authorization": f"Bearer {tokens['access_token']}"})
    refresh = await client.post(REFRESH_URL, json={"refresh_token": tokens["refresh_token"]})

    assert me.status_code == 200
    assert refresh.status_code == 200


async def test_linkedin_only_account_can_set_a_first_password(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    async with SessionLocal() as session:
        session.add(User(email=_EMAIL, full_name="LinkedIn Only", password=None))
        await session.commit()
    assert await _login(client, _NEW_PASSWORD) == 401

    await client.post(REQUEST_URL, json={"email": _EMAIL})
    confirmed = await client.post(
        CONFIRM_URL, json={"token": sender.last_token(), "new_password": _NEW_PASSWORD}
    )

    assert confirmed.status_code == 204
    assert await _login(client, _NEW_PASSWORD) == 200


async def test_inactive_account_gets_no_email(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    await _register(client)
    async with SessionLocal() as session:
        await session.execute(update(User).values(is_active=False))
        await session.commit()

    response = await client.post(REQUEST_URL, json={"email": _EMAIL})

    assert response.status_code == 202
    assert sender.sent == []
