"""Users, requests and verified emails shared by the connections and people tests."""

import uuid
from datetime import UTC, datetime

from httpx import AsyncClient
from sqlalchemy import event

from app.core.database import SessionLocal, engine
from app.modules.verification.models import EmailVerification

URL = "/api/v1/connections"
REQUESTS_URL = f"{URL}/requests"
PEOPLE_URL = "/api/v1/people"
REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/auth/me"
PROFILE_URL = "/api/v1/profile/me"
PASSWORD = "secret123"


async def user(client: AsyncClient, name: str, **profile: str) -> tuple[dict, str]:
    """A signed-up user called `name` (capitalised), with any profile fields
    given: (auth headers, user id)."""
    email = f"{name}@example.com"
    await client.post(
        REGISTER_URL,
        json={
            "email": email,
            "password": PASSWORD,
            "full_name": name.capitalize(),
            "role": "candidate",
        },
    )
    login = await client.post(LOGIN_URL, json={"email": email, "password": PASSWORD})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    if profile:
        await client.patch(PROFILE_URL, headers=headers, json=profile)
    user_id = (await client.get(ME_URL, headers=headers)).json()["id"]
    return headers, user_id


async def ask(client: AsyncClient, headers: dict, user_id: str):
    return await client.post(REQUESTS_URL, headers=headers, json={"user_id": user_id})


async def received(client: AsyncClient, headers: dict) -> list[dict]:
    return (await client.get(REQUESTS_URL, headers=headers)).json()


async def connect(client: AsyncClient, one: tuple[dict, str], other: tuple[dict, str]) -> None:
    """`one` asks and `other` accepts."""
    await ask(client, one[0], other[1])
    request_id = (await received(client, other[0]))[0]["id"]
    await client.post(f"{REQUESTS_URL}/{request_id}/accept", headers=other[0])


async def relationship(client: AsyncClient, headers: dict, user_id: str) -> dict:
    return (await client.get(f"{URL}/with/{user_id}", headers=headers)).json()


async def verify(user_id: str, kind: str, email: str) -> None:
    """Mark an email verified directly - the code flow has its own tests."""
    now = datetime.now(UTC)
    async with SessionLocal() as session:
        session.add(
            EmailVerification(
                user_id=uuid.UUID(user_id),
                email=email,
                kind=kind,
                code_hash="x",
                expires_at=now,
                verified_at=now,
            )
        )
        await session.commit()


async def count_queries(client: AsyncClient, url: str, headers: dict, **params: str) -> int:
    """How many SQL statements one GET runs - for N+1 checks."""
    count = 0

    def _count(*_args) -> None:
        nonlocal count
        count += 1

    event.listen(engine.sync_engine, "before_cursor_execute", _count)
    try:
        await client.get(url, headers=headers, params=params)
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", _count)
    return count
