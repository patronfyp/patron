"""Tests for the notifications module - Module 11.1, 11.2, 11.6."""

import re
import uuid
from collections.abc import AsyncIterator

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.email import get_email_sender
from app.main import app
from app.modules.auth.models import User
from app.modules.notifications import service
from app.modules.notifications.models import NotificationType
from tests.fakes import MemoryStorage

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
LIST_URL = "/api/v1/notifications/me"
COUNT_URL = "/api/v1/notifications/me/unread-count"
READ_ALL_URL = "/api/v1/notifications/me/read-all"

_PASSWORD = "secret123"


async def _sign_in(client: AsyncClient, email: str = "notify@example.com") -> dict:
    await client.post(
        REGISTER_URL,
        json={"email": email, "password": _PASSWORD, "full_name": "Notify", "role": "candidate"},
    )
    login = await client.post(LOGIN_URL, json={"email": email, "password": _PASSWORD})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def _notify(email: str, title: str, *, link: str | None = None) -> None:
    """Create a notification the way other modules do - through the service."""
    async with SessionLocal() as session:
        user = await session.scalar(select(User).where(User.email == email))
        await service.notify(
            session, user.id, NotificationType.EMAIL_VERIFIED, title, body="Body", link=link
        )


async def test_endpoints_require_a_token(client: AsyncClient) -> None:
    assert (await client.get(LIST_URL)).status_code == 401
    assert (await client.get(COUNT_URL)).status_code == 401
    assert (await client.post(READ_ALL_URL)).status_code == 401
    assert (await client.post(f"/api/v1/notifications/{uuid.uuid4()}/read")).status_code == 401


async def test_a_new_user_has_no_notifications(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)

    listing = await client.get(LIST_URL, headers=headers)
    count = await client.get(COUNT_URL, headers=headers)

    assert listing.json() == {"items": [], "total": 0, "limit": 20, "offset": 0}
    assert count.json() == {"count": 0}


async def test_notifications_are_listed_newest_first(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)
    for title in ["First", "Second", "Third"]:
        await _notify("notify@example.com", title)

    response = await client.get(LIST_URL, headers=headers)

    body = response.json()
    assert [item["title"] for item in body["items"]] == ["Third", "Second", "First"]
    assert body["total"] == 3
    assert body["items"][0]["read_at"] is None


async def test_the_list_is_paginated(client: AsyncClient, clean_users_table: None) -> None:
    headers = await _sign_in(client)
    for index in range(5):
        await _notify("notify@example.com", f"N{index}")

    page = await client.get(LIST_URL, headers=headers, params={"limit": 2, "offset": 2})

    assert [item["title"] for item in page.json()["items"]] == ["N2", "N1"]
    assert page.json()["total"] == 5
    assert page.json()["limit"] == 2
    assert page.json()["offset"] == 2


async def test_a_limit_above_100_is_rejected(client: AsyncClient, clean_users_table: None) -> None:
    """STANDARDS.md §3.3 - a huge limit is a 422, not a slow query."""
    headers = await _sign_in(client)

    too_big = await client.get(LIST_URL, headers=headers, params={"limit": 101})
    negative = await client.get(LIST_URL, headers=headers, params={"offset": -1})

    assert too_big.status_code == 422
    assert negative.status_code == 422


async def test_users_only_see_their_own(client: AsyncClient, clean_users_table: None) -> None:
    alice = await _sign_in(client, "alice@example.com")
    await _sign_in(client, "bob@example.com")
    await _notify("bob@example.com", "For Bob")

    response = await client.get(LIST_URL, headers=alice)

    assert response.json()["total"] == 0


async def test_marking_one_read_lowers_the_unread_count(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)
    await _notify("notify@example.com", "One")
    await _notify("notify@example.com", "Two")
    target = (await client.get(LIST_URL, headers=headers)).json()["items"][0]

    response = await client.post(f"/api/v1/notifications/{target['id']}/read", headers=headers)

    assert response.status_code == 200
    assert response.json()["read_at"] is not None
    assert (await client.get(COUNT_URL, headers=headers)).json() == {"count": 1}


async def test_marking_read_twice_keeps_the_first_time(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)
    await _notify("notify@example.com", "One")
    target = (await client.get(LIST_URL, headers=headers)).json()["items"][0]
    url = f"/api/v1/notifications/{target['id']}/read"

    first = await client.post(url, headers=headers)
    second = await client.post(url, headers=headers)

    assert second.json()["read_at"] == first.json()["read_at"]


async def test_someone_elses_notification_is_a_404(
    client: AsyncClient, clean_users_table: None
) -> None:
    """A 403 would confirm the notification exists."""
    alice = await _sign_in(client, "alice@example.com")
    bob = await _sign_in(client, "bob@example.com")
    await _notify("bob@example.com", "For Bob")
    bobs = (await client.get(LIST_URL, headers=bob)).json()["items"][0]

    stolen = await client.post(f"/api/v1/notifications/{bobs['id']}/read", headers=alice)
    unknown = await client.post(f"/api/v1/notifications/{uuid.uuid4()}/read", headers=alice)

    assert stolen.status_code == 404
    assert unknown.status_code == 404
    assert (await client.get(COUNT_URL, headers=bob)).json() == {"count": 1}


async def test_read_all_clears_only_your_own(client: AsyncClient, clean_users_table: None) -> None:
    alice = await _sign_in(client, "alice@example.com")
    bob = await _sign_in(client, "bob@example.com")
    for title in ["A1", "A2"]:
        await _notify("alice@example.com", title)
    await _notify("bob@example.com", "B1")

    response = await client.post(READ_ALL_URL, headers=alice)

    assert response.status_code == 204
    assert (await client.get(COUNT_URL, headers=alice)).json() == {"count": 0}
    assert (await client.get(COUNT_URL, headers=bob)).json() == {"count": 1}


async def test_only_app_paths_are_kept_as_links(
    client: AsyncClient, clean_users_table: None
) -> None:
    """A notification must never send anyone off-site."""
    headers = await _sign_in(client)
    await _notify("notify@example.com", "Off-site", link="https://evil.example.com")
    await _notify("notify@example.com", "Protocol-relative", link="//evil.example.com")
    await _notify("notify@example.com", "In-app", link="/onboarding")

    items = (await client.get(LIST_URL, headers=headers)).json()["items"]

    links = {item["title"]: item["link"] for item in items}
    assert links == {"In-app": "/onboarding", "Protocol-relative": None, "Off-site": None}


# --- Real triggers --------------------------------------------------------------


class RecordingSender:
    def __init__(self) -> None:
        self.sent: list[str] = []

    async def send(self, to: str, subject: str, body: str) -> None:
        self.sent.append(body)

    def last_code(self) -> str:
        return re.search(r"\b\d{6}\b", self.sent[-1]).group()


@pytest.fixture
async def sender() -> AsyncIterator[RecordingSender]:
    recording = RecordingSender()
    app.dependency_overrides[get_email_sender] = lambda: recording
    yield recording
    app.dependency_overrides.pop(get_email_sender, None)


async def test_verifying_a_work_email_sends_a_notification(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_in(client)
    work = {"email": "abdul@garner.com", "kind": "employer"}
    await client.post("/api/v1/verification/email/send", headers=headers, json=work)
    await client.post(
        "/api/v1/verification/email/confirm",
        headers=headers,
        json={**work, "code": sender.last_code()},
    )

    items = (await client.get(LIST_URL, headers=headers)).json()["items"]

    assert len(items) == 1
    assert items[0]["type"] == "email_verified"
    assert items[0]["title"] == "Work email verified"
    assert "abdul@garner.com" in items[0]["body"]


async def test_verifying_the_sign_up_email_sends_no_notification(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    """The user is looking at the screen that confirmed it - no badge, no notification."""
    headers = await _sign_in(client)
    account = {"email": "notify@example.com", "kind": "account"}
    await client.post("/api/v1/verification/email/send", headers=headers, json=account)
    await client.post(
        "/api/v1/verification/email/confirm",
        headers=headers,
        json={**account, "code": sender.last_code()},
    )

    assert (await client.get(COUNT_URL, headers=headers)).json() == {"count": 0}


async def test_uploading_a_document_sends_a_notification(
    client: AsyncClient, clean_users_table: None, storage: MemoryStorage
) -> None:
    headers = await _sign_in(client)

    await client.post(
        "/api/v1/verification/documents",
        headers=headers,
        data={"kind": "university"},
        files={"file": ("transcript.pdf", b"%PDF-1.7\ntranscript", "application/pdf")},
    )

    items = (await client.get(LIST_URL, headers=headers)).json()["items"]
    assert [item["title"] for item in items] == ["University document received"]
    assert items[0]["type"] == "document_uploaded"
