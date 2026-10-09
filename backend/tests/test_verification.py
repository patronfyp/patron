"""Tests for POST /api/v1/verification/email/send and /confirm - Module 1.9."""

import re
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.core.email import EmailDeliveryError, get_email_sender
from app.modules.verification.models import EmailVerification
from db import SessionLocal
from main import app

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
PROFILE_URL = "/api/v1/profile/me"
SEND_URL = "/api/v1/verification/email/send"
CONFIRM_URL = "/api/v1/verification/email/confirm"

_PASSWORD = "secret123"
_LUMS = "Lahore University of Management Sciences (LUMS)"
_UNI_EMAIL = "abdul@lums.edu.pk"
_WORK_EMAIL = "abdul@garner.com"


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

    def last_code(self) -> str:
        return re.search(r"\b\d{6}\b", self.sent[-1]["body"]).group()


@pytest.fixture
async def sender() -> AsyncIterator[RecordingSender]:
    recording = RecordingSender()
    app.dependency_overrides[get_email_sender] = lambda: recording
    yield recording
    app.dependency_overrides.pop(get_email_sender, None)


async def _sign_in(client: AsyncClient, university: str | None = _LUMS) -> dict:
    """Register, log in, optionally save a university; return the auth header."""
    email = "verify-test@example.com"
    await client.post(
        REGISTER_URL,
        json={
            "email": email,
            "password": _PASSWORD,
            "full_name": "Verify Test",
            "role": "candidate",
        },
    )
    login = await client.post(LOGIN_URL, json={"email": email, "password": _PASSWORD})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    if university is not None:
        await client.patch(PROFILE_URL, headers=headers, json={"university": university})
    return headers


def _uni(code: str | None = None) -> dict:
    body = {"email": _UNI_EMAIL, "kind": "university"}
    return body if code is None else {**body, "code": code}


def _wrong(code: str) -> str:
    return "000000" if code != "000000" else "111111"


async def test_endpoints_require_a_token(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    assert (await client.post(SEND_URL, json=_uni())).status_code == 401
    assert (await client.post(CONFIRM_URL, json=_uni("123456"))).status_code == 401


async def test_send_then_confirm_verifies_the_email(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client)

    sent = await client.post(SEND_URL, headers=headers, json=_uni())
    confirmed = await client.post(CONFIRM_URL, headers=headers, json=_uni(sender.last_code()))

    assert sent.status_code == 202
    assert sent.json()["expires_in_seconds"] == 600
    assert sent.json()["resend_after_seconds"] == 60
    assert "code" not in sent.json()
    assert sender.sent[-1]["to"] == _UNI_EMAIL
    assert confirmed.status_code == 200
    assert confirmed.json()["email"] == _UNI_EMAIL
    assert confirmed.json()["verified_at"] is not None


async def test_code_is_stored_hashed(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client)
    await client.post(SEND_URL, headers=headers, json=_uni())

    async with SessionLocal() as session:
        row = await session.scalar(
            select(EmailVerification).where(EmailVerification.email == _UNI_EMAIL)
        )

    assert row.code_hash != sender.last_code()
    assert len(row.code_hash) == 64  # a SHA-256 hex digest, not the 6-digit code


async def test_wrong_code_is_rejected(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client)
    await client.post(SEND_URL, headers=headers, json=_uni())

    response = await client.post(
        CONFIRM_URL, headers=headers, json=_uni(_wrong(sender.last_code()))
    )

    assert response.status_code == 400


async def test_expired_code_is_rejected(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client)
    await client.post(SEND_URL, headers=headers, json=_uni())
    async with SessionLocal() as session:
        await session.execute(
            update(EmailVerification).values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
        await session.commit()

    response = await client.post(CONFIRM_URL, headers=headers, json=_uni(sender.last_code()))

    assert response.status_code == 400


async def test_code_works_only_once(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client)
    await client.post(SEND_URL, headers=headers, json=_uni())
    code = sender.last_code()
    await client.post(CONFIRM_URL, headers=headers, json=_uni(code))

    again = await client.post(CONFIRM_URL, headers=headers, json=_uni(code))

    assert again.status_code == 400


async def test_code_locks_after_five_wrong_tries(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client)
    await client.post(SEND_URL, headers=headers, json=_uni())
    code = sender.last_code()
    for _ in range(5):
        await client.post(CONFIRM_URL, headers=headers, json=_uni(_wrong(code)))

    # The right code no longer works once the limit is reached.
    response = await client.post(CONFIRM_URL, headers=headers, json=_uni(code))

    assert response.status_code == 400


async def test_resend_is_rate_limited(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client)
    await client.post(SEND_URL, headers=headers, json=_uni())

    again = await client.post(SEND_URL, headers=headers, json=_uni())

    assert again.status_code == 429
    assert len(sender.sent) == 1


async def test_new_code_replaces_the_old_one(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client)
    await client.post(SEND_URL, headers=headers, json=_uni())
    old_code = sender.last_code()
    # Push the first send outside the cooldown instead of waiting 60 seconds.
    async with SessionLocal() as session:
        await session.execute(
            update(EmailVerification).values(created_at=datetime.now(UTC) - timedelta(minutes=2))
        )
        await session.commit()
    await client.post(SEND_URL, headers=headers, json=_uni())
    new_code = sender.last_code()

    if old_code != new_code:
        old = await client.post(CONFIRM_URL, headers=headers, json=_uni(old_code))
        assert old.status_code == 400
    new = await client.post(CONFIRM_URL, headers=headers, json=_uni(new_code))
    assert new.status_code == 200


async def test_university_email_must_match_the_profile_university(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client)

    response = await client.post(
        SEND_URL, headers=headers, json={"email": "abdul@nust.edu.pk", "kind": "university"}
    )

    assert response.status_code == 422
    assert sender.sent == []


async def test_university_subdomain_is_accepted(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client)

    response = await client.post(
        SEND_URL, headers=headers, json={"email": "abdul@cs.lums.edu.pk", "kind": "university"}
    )

    assert response.status_code == 202


async def test_university_not_on_the_list_is_rejected(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client, university="Some Other University")

    response = await client.post(SEND_URL, headers=headers, json=_uni())

    assert response.status_code == 422


async def test_personal_email_is_rejected_as_a_work_email(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client, university=None)

    personal = await client.post(
        SEND_URL, headers=headers, json={"email": "abdul@gmail.com", "kind": "employer"}
    )
    work = await client.post(
        SEND_URL, headers=headers, json={"email": _WORK_EMAIL, "kind": "employer"}
    )

    assert personal.status_code == 422
    assert work.status_code == 202


async def test_code_must_be_six_digits(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client)

    short = await client.post(CONFIRM_URL, headers=headers, json=_uni("12345"))
    letters = await client.post(CONFIRM_URL, headers=headers, json=_uni("12a456"))

    assert short.status_code == 422
    assert letters.status_code == 422


async def test_provider_failure_returns_503_and_allows_an_immediate_retry(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    """If the email never left, the code must not count - no row left behind,
    and no 60-second cooldown for a code the user never received."""
    headers = await _sign_in(client)
    sender.fail_next = True

    failed = await client.post(SEND_URL, headers=headers, json=_uni())
    async with SessionLocal() as session:
        rows = (await session.scalars(select(EmailVerification))).all()
    retry = await client.post(SEND_URL, headers=headers, json=_uni())

    assert failed.status_code == 503
    assert rows == []
    assert retry.status_code == 202
