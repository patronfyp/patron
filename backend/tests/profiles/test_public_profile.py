"""Tests for GET /api/v1/profile/{user_id} - the public profile, Module 1.6."""

import re
import uuid
from collections.abc import AsyncIterator

import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.core.database import SessionLocal
from app.core.email import get_email_sender
from app.main import app
from app.modules.auth.models import User

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
PROFILE_URL = "/api/v1/profile/me"

_PASSWORD = "secret123"


async def _sign_up(client: AsyncClient, email: str, name: str = "Jane Doe") -> tuple[dict, str]:
    """Register and log in; return the auth header and the user id."""
    registered = await client.post(
        REGISTER_URL,
        json={"email": email, "password": _PASSWORD, "full_name": name, "role": "candidate"},
    )
    login = await client.post(LOGIN_URL, json={"email": email, "password": _PASSWORD})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}, registered.json()["id"]


def _public(user_id: str) -> str:
    return f"/api/v1/profile/{user_id}"


async def test_it_requires_a_token(client: AsyncClient) -> None:
    assert (await client.get(_public(str(uuid.uuid4())))).status_code == 401


async def test_shows_the_public_fields(client: AsyncClient, clean_users_table: None) -> None:
    owner, owner_id = await _sign_up(client, "jane@example.com")
    viewer, _ = await _sign_up(client, "viewer@example.com", "Viewer")
    await client.patch(
        PROFILE_URL,
        headers=owner,
        json={
            "headline": "Backend engineer",
            "city": "Lahore, Pakistan",
            "bio": "I build APIs.",
            "university": "Lahore University of Management Sciences (LUMS)",
            "degree": "BSc Computer Science",
            "graduation_year": 2026,
            "employer_name": "Garner",
            "skills": ["Python", "FastAPI"],
            "primary_role": "backend",
        },
    )

    response = await client.get(_public(owner_id), headers=viewer)

    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "Jane Doe"
    assert body["roles"] == ["candidate"]
    assert body["headline"] == "Backend engineer"
    assert body["university"] == "Lahore University of Management Sciences (LUMS)"
    assert body["skills"] == ["Python", "FastAPI"]
    assert body["university_verified"] is False
    assert body["employer_verified"] is False


async def test_never_shows_private_fields(client: AsyncClient, clean_users_table: None) -> None:
    owner, owner_id = await _sign_up(client, "jane@example.com")
    viewer, _ = await _sign_up(client, "viewer@example.com", "Viewer")
    await client.patch(
        PROFILE_URL,
        headers=owner,
        json={"phone": "+923001234567", "salary_min": 250000, "salary_max": 350000},
    )

    body = (await client.get(_public(owner_id), headers=viewer)).json()

    for private in [
        "phone",
        "email",
        "cv",
        "salary_min",
        "salary_max",
        "desired_roles",
        "preferred_locations",
        "available_from",
        "onboarding_step",
    ]:
        assert private not in body
    assert "+923001234567" not in str(body)


async def test_someone_who_never_opened_onboarding_has_empty_fields(
    client: AsyncClient, clean_users_table: None
) -> None:
    """Viewing a profile must not create one for its owner."""
    _, owner_id = await _sign_up(client, "jane@example.com")
    viewer, _ = await _sign_up(client, "viewer@example.com", "Viewer")

    body = (await client.get(_public(owner_id), headers=viewer)).json()

    assert body["headline"] is None
    assert body["skills"] == []


async def test_an_unknown_user_is_a_404(client: AsyncClient, clean_users_table: None) -> None:
    viewer, _ = await _sign_up(client, "viewer@example.com")

    response = await client.get(_public(str(uuid.uuid4())), headers=viewer)

    assert response.status_code == 404


async def test_a_deactivated_user_is_a_404(client: AsyncClient, clean_users_table: None) -> None:
    """Module 13.2 - a banned account disappears, it isn't shown as banned."""
    _, owner_id = await _sign_up(client, "jane@example.com")
    viewer, _ = await _sign_up(client, "viewer@example.com", "Viewer")
    async with SessionLocal() as session:
        await session.execute(
            update(User).where(User.id == uuid.UUID(owner_id)).values(is_active=False)
        )
        await session.commit()

    response = await client.get(_public(owner_id), headers=viewer)

    assert response.status_code == 404


async def test_profile_me_still_returns_your_own_profile(
    client: AsyncClient, clean_users_table: None
) -> None:
    """The /{user_id} route is declared after /me so it can't swallow it."""
    owner, _ = await _sign_up(client, "jane@example.com")

    response = await client.get(PROFILE_URL, headers=owner)

    assert response.status_code == 200
    assert "onboarding_step" in response.json()


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


async def test_a_verified_work_email_shows_the_employee_badge(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner, owner_id = await _sign_up(client, "jane@example.com")
    viewer, _ = await _sign_up(client, "viewer@example.com", "Viewer")
    work = {"email": "jane@garner.com", "kind": "employer"}
    await client.post("/api/v1/verification/email/send", headers=owner, json=work)
    await client.post(
        "/api/v1/verification/email/confirm",
        headers=owner,
        json={**work, "code": sender.last_code()},
    )

    body = (await client.get(_public(owner_id), headers=viewer)).json()

    assert body["employer_verified"] is True
    # The badge, not the work address itself.
    assert "jane@garner.com" not in str(body)
