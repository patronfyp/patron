"""Tests for verifying the sign-up email (the Account onboarding step),
verification documents, and GET /api/v1/verification/me."""

import re
from collections.abc import AsyncIterator

import pytest
from conftest import MemoryStorage
from httpx import AsyncClient

from app.core.email import get_email_sender
from main import app

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/auth/me"
SEND_URL = "/api/v1/verification/email/send"
CONFIRM_URL = "/api/v1/verification/email/confirm"
STATUS_URL = "/api/v1/verification/me"
DOCUMENTS_URL = "/api/v1/verification/documents"

_EMAIL = "account@example.com"
_PASSWORD = "secret123"
_PDF = b"%PDF-1.7\n" + b"transcript"


class RecordingSender:
    def __init__(self) -> None:
        self.sent: list[dict[str, str]] = []

    async def send(self, to: str, subject: str, body: str) -> None:
        self.sent.append({"to": to, "subject": subject, "body": body})

    def last_code(self) -> str:
        return re.search(r"\b\d{6}\b", self.sent[-1]["body"]).group()


@pytest.fixture
async def sender() -> AsyncIterator[RecordingSender]:
    recording = RecordingSender()
    app.dependency_overrides[get_email_sender] = lambda: recording
    yield recording
    app.dependency_overrides.pop(get_email_sender, None)


async def _sign_in(client: AsyncClient) -> dict:
    await client.post(
        REGISTER_URL,
        json={"email": _EMAIL, "password": _PASSWORD, "full_name": "Acc", "role": "candidate"},
    )
    login = await client.post(LOGIN_URL, json={"email": _EMAIL, "password": _PASSWORD})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def test_verifying_the_sign_up_email_marks_the_account_verified(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client)

    sent = await client.post(SEND_URL, headers=headers, json={"email": _EMAIL, "kind": "account"})
    confirmed = await client.post(
        CONFIRM_URL,
        headers=headers,
        json={"email": _EMAIL, "kind": "account", "code": sender.last_code()},
    )

    assert sent.status_code == 202
    assert sender.sent[-1]["to"] == _EMAIL
    assert confirmed.status_code == 200
    me = await client.get(ME_URL, headers=headers)
    assert me.json()["is_email_verified"] is True


async def test_account_kind_only_accepts_the_sign_up_address(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    """Otherwise it would verify an address the account doesn't have."""
    headers = await _sign_in(client)

    response = await client.post(
        SEND_URL, headers=headers, json={"email": "someone-else@example.com", "kind": "account"}
    )

    assert response.status_code == 422
    assert sender.sent == []


async def test_an_already_verified_email_is_not_sent_another_code(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client)
    await client.post(SEND_URL, headers=headers, json={"email": _EMAIL, "kind": "account"})
    await client.post(
        CONFIRM_URL,
        headers=headers,
        json={"email": _EMAIL, "kind": "account", "code": sender.last_code()},
    )

    again = await client.post(SEND_URL, headers=headers, json={"email": _EMAIL, "kind": "account"})

    assert again.status_code == 422


async def test_a_wrong_code_leaves_the_account_unverified(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client)
    await client.post(SEND_URL, headers=headers, json={"email": _EMAIL, "kind": "account"})
    wrong = "000000" if sender.last_code() != "000000" else "111111"

    response = await client.post(
        CONFIRM_URL, headers=headers, json={"email": _EMAIL, "kind": "account", "code": wrong}
    )

    assert response.status_code == 400
    me = await client.get(ME_URL, headers=headers)
    assert me.json()["is_email_verified"] is False


async def test_status_starts_empty(client: AsyncClient, clean_users_table: None) -> None:
    headers = await _sign_in(client)

    response = await client.get(STATUS_URL, headers=headers)

    assert response.status_code == 200
    assert response.json() == {
        "email": _EMAIL,
        "email_verified": False,
        "university_email": None,
        "employer_email": None,
        "documents": [],
    }


async def test_status_reports_a_verified_work_email(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client)
    work = {"email": "abdul@garner.com", "kind": "employer"}
    await client.post(SEND_URL, headers=headers, json=work)
    await client.post(CONFIRM_URL, headers=headers, json={**work, "code": sender.last_code()})

    response = await client.get(STATUS_URL, headers=headers)

    assert response.json()["employer_email"]["email"] == "abdul@garner.com"
    assert response.json()["university_email"] is None


async def test_a_registrar_document_is_stored_as_pending(
    client: AsyncClient, clean_users_table: None, storage: MemoryStorage
) -> None:
    headers = await _sign_in(client)

    response = await client.post(
        DOCUMENTS_URL,
        headers=headers,
        data={"kind": "university"},
        files={"file": ("transcript.pdf", _PDF, "application/pdf")},
    )

    assert response.status_code == 201
    assert response.json()["status"] == "pending"
    assert response.json()["filename"] == "transcript.pdf"
    assert len(storage.files) == 1
    status = await client.get(STATUS_URL, headers=headers)
    assert [d["status"] for d in status.json()["documents"]] == ["pending"]


async def test_documents_are_not_for_the_account_email(
    client: AsyncClient, clean_users_table: None, storage: MemoryStorage
) -> None:
    headers = await _sign_in(client)

    response = await client.post(
        DOCUMENTS_URL,
        headers=headers,
        data={"kind": "account"},
        files={"file": ("id.pdf", _PDF, "application/pdf")},
    )

    assert response.status_code == 422
    assert storage.files == {}


async def test_documents_require_a_token(client: AsyncClient, storage: MemoryStorage) -> None:
    response = await client.post(
        DOCUMENTS_URL,
        data={"kind": "university"},
        files={"file": ("transcript.pdf", _PDF, "application/pdf")},
    )

    assert response.status_code == 401
