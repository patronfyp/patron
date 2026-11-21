"""Tests for /api/v1/connections (#119): requests, connections, mutuals and types."""

import uuid
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import event, update

from app.core.database import SessionLocal, engine
from app.core.rate_limit import CONNECTION_REQUESTS_PER_USER, RateLimiter
from app.modules.connections.models import ConnectionRequest
from app.modules.verification.models import EmailVerification

URL = "/api/v1/connections"
REQUESTS_URL = f"{URL}/requests"
REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/auth/me"
NOTIFICATIONS_URL = "/api/v1/notifications/me"
PASSWORD = "secret123"


async def _user(client: AsyncClient, name: str) -> tuple[dict, str]:
    """A signed-up user called `name` (capitalised): (auth headers, user id)."""
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
    user_id = (await client.get(ME_URL, headers=headers)).json()["id"]
    return headers, user_id


async def _ask(client: AsyncClient, headers: dict, user_id: str):
    return await client.post(REQUESTS_URL, headers=headers, json={"user_id": user_id})


async def _received(client: AsyncClient, headers: dict) -> list[dict]:
    return (await client.get(REQUESTS_URL, headers=headers)).json()


async def _connect(client: AsyncClient, one: tuple[dict, str], other: tuple[dict, str]) -> None:
    await _ask(client, one[0], other[1])
    request_id = (await _received(client, other[0]))[0]["id"]
    await client.post(f"{REQUESTS_URL}/{request_id}/accept", headers=other[0])


async def _with(client: AsyncClient, headers: dict, user_id: str) -> dict:
    return (await client.get(f"{URL}/with/{user_id}", headers=headers)).json()


async def _verify(user_id: str, kind: str, email: str) -> None:
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


async def test_sending_accepting_and_listing(client: AsyncClient, clean_users_table: None) -> None:
    ayesha, bilal = await _user(client, "ayesha"), await _user(client, "bilal")

    sent = await _ask(client, ayesha[0], bilal[1])
    inbox = await _received(client, bilal[0])
    outbox = (
        await client.get(REQUESTS_URL, headers=ayesha[0], params={"direction": "sent"})
    ).json()
    accepted = await client.post(f"{REQUESTS_URL}/{inbox[0]['id']}/accept", headers=bilal[0])
    ayeshas = (await client.get(URL, headers=ayesha[0])).json()
    bilals = (await client.get(URL, headers=bilal[0])).json()

    assert sent.status_code == 201
    assert sent.json()["status"] == "pending_sent"
    assert inbox[0]["person"]["full_name"] == "Ayesha"
    assert inbox[0]["direction"] == "received"
    assert outbox[0]["person"]["user_id"] == bilal[1]
    assert accepted.status_code == 204
    assert ayeshas["total"] == 1
    assert ayeshas["items"][0]["person"]["user_id"] == bilal[1]
    assert ayeshas["items"][0]["connection_type"] == "professional"
    assert bilals["items"][0]["person"]["user_id"] == ayesha[1]
    assert await _received(client, bilal[0]) == []


async def test_both_sides_are_notified(client: AsyncClient, clean_users_table: None) -> None:
    ayesha, bilal = await _user(client, "ayesha"), await _user(client, "bilal")

    await _connect(client, ayesha, bilal)

    bilal_notes = (await client.get(NOTIFICATIONS_URL, headers=bilal[0])).json()
    ayesha_notes = (await client.get(NOTIFICATIONS_URL, headers=ayesha[0])).json()
    assert "Ayesha wants to connect" in str(bilal_notes)
    assert "Bilal accepted your request" in str(ayesha_notes)


async def test_no_request_to_yourself_twice_or_when_connected(
    client: AsyncClient, clean_users_table: None
) -> None:
    ayesha, bilal = await _user(client, "ayesha"), await _user(client, "bilal")

    to_self = await _ask(client, ayesha[0], ayesha[1])
    to_nobody = await _ask(client, ayesha[0], str(uuid.uuid4()))
    await _ask(client, ayesha[0], bilal[1])
    twice = await _ask(client, ayesha[0], bilal[1])
    request_id = (await _received(client, bilal[0]))[0]["id"]
    await client.post(f"{REQUESTS_URL}/{request_id}/accept", headers=bilal[0])
    when_connected = await _ask(client, ayesha[0], bilal[1])

    assert to_self.status_code == 422
    assert to_nobody.status_code == 404
    assert twice.status_code == 409
    assert when_connected.status_code == 409


async def test_asking_someone_who_asked_you_connects_you(
    client: AsyncClient, clean_users_table: None
) -> None:
    ayesha, bilal = await _user(client, "ayesha"), await _user(client, "bilal")
    await _ask(client, ayesha[0], bilal[1])

    response = await _ask(client, bilal[0], ayesha[1])

    assert response.status_code == 200
    assert response.json()["status"] == "connected"
    assert (await client.get(URL, headers=ayesha[0])).json()["total"] == 1


async def test_a_decline_is_never_revealed_to_the_sender(
    client: AsyncClient, clean_users_table: None
) -> None:
    ayesha, bilal = await _user(client, "ayesha"), await _user(client, "bilal")
    await _ask(client, ayesha[0], bilal[1])
    request_id = (await _received(client, bilal[0]))[0]["id"]

    declined = await client.post(f"{REQUESTS_URL}/{request_id}/decline", headers=bilal[0])
    seen_by_ayesha = await _with(client, ayesha[0], bilal[1])
    again = await _ask(client, ayesha[0], bilal[1])

    assert declined.status_code == 204
    assert await _received(client, bilal[0]) == []
    assert seen_by_ayesha["status"] == "pending_sent"
    assert again.status_code == 409
    assert again.json()["detail"] == "You've already sent a request"


async def test_a_withdrawn_request_can_be_sent_again_after_30_days(
    client: AsyncClient, clean_users_table: None
) -> None:
    ayesha, bilal = await _user(client, "ayesha"), await _user(client, "bilal")
    request_id = (await _ask(client, ayesha[0], bilal[1])).json()["request_id"]

    withdrawn = await client.delete(f"{REQUESTS_URL}/{request_id}", headers=ayesha[0])
    too_soon = await _ask(client, ayesha[0], bilal[1])
    async with SessionLocal() as session:
        await session.execute(
            update(ConnectionRequest).values(responded_at=datetime.now(UTC) - timedelta(days=31))
        )
        await session.commit()
    later = await _ask(client, ayesha[0], bilal[1])

    assert withdrawn.status_code == 204
    assert (await _with(client, ayesha[0], bilal[1]))["status"] == "pending_sent"
    assert too_soon.status_code == 409
    assert later.status_code == 201
    assert len(await _received(client, bilal[0])) == 1


async def test_only_the_receiver_can_accept_and_only_the_sender_can_withdraw(
    client: AsyncClient, clean_users_table: None
) -> None:
    ayesha, bilal = await _user(client, "ayesha"), await _user(client, "bilal")
    zara = await _user(client, "zara")
    request_id = (await _ask(client, ayesha[0], bilal[1])).json()["request_id"]

    accepted_by_sender = await client.post(f"{REQUESTS_URL}/{request_id}/accept", headers=ayesha[0])
    accepted_by_stranger = await client.post(f"{REQUESTS_URL}/{request_id}/accept", headers=zara[0])
    withdrawn_by_receiver = await client.delete(f"{REQUESTS_URL}/{request_id}", headers=bilal[0])

    assert accepted_by_sender.status_code == 404
    assert accepted_by_stranger.status_code == 404
    assert withdrawn_by_receiver.status_code == 404


async def test_removing_a_connection(client: AsyncClient, clean_users_table: None) -> None:
    ayesha, bilal = await _user(client, "ayesha"), await _user(client, "bilal")
    await _connect(client, ayesha, bilal)

    removed = await client.delete(f"{URL}/{bilal[1]}", headers=ayesha[0])
    again = await client.delete(f"{URL}/{bilal[1]}", headers=ayesha[0])

    assert removed.status_code == 204
    assert again.status_code == 404
    assert (await client.get(URL, headers=bilal[0])).json()["total"] == 0
    assert (await _with(client, ayesha[0], bilal[1]))["status"] == "none"


async def test_the_list_is_paged_and_searchable(
    client: AsyncClient, clean_users_table: None
) -> None:
    me = await _user(client, "me")
    for name in ("ayesha", "bilal", "sara"):
        await _connect(client, await _user(client, name), me)

    first = (await client.get(URL, headers=me[0], params={"limit": 2})).json()
    second = (await client.get(URL, headers=me[0], params={"limit": 2, "offset": 2})).json()
    found = (await client.get(URL, headers=me[0], params={"q": "BIL"})).json()
    wildcard = (await client.get(URL, headers=me[0], params={"q": "%"})).json()
    too_many = await client.get(URL, headers=me[0], params={"limit": 101})

    assert first["total"] == 3
    assert len(first["items"]) == 2
    assert len(second["items"]) == 1
    # Newest first: Sara connected last.
    assert first["items"][0]["person"]["full_name"] == "Sara"
    assert [item["person"]["full_name"] for item in found["items"]] == ["Bilal"]
    assert wildcard["total"] == 0
    assert too_many.status_code == 422


async def test_mutual_connections(client: AsyncClient, clean_users_table: None) -> None:
    ayesha, bilal = await _user(client, "ayesha"), await _user(client, "bilal")
    sara, zara, omar = (
        await _user(client, "sara"),
        await _user(client, "zara"),
        await _user(client, "omar"),
    )
    for friend in (sara, zara, omar):
        await _connect(client, ayesha, friend)
    for friend in (sara, zara):
        await _connect(client, bilal, friend)

    seen = await _with(client, ayesha[0], bilal[1])

    assert seen["status"] == "none"
    assert seen["mutual_count"] == 2
    assert [person["full_name"] for person in seen["mutual"]] == ["Sara", "Zara"]


async def test_the_connection_type_comes_from_verified_emails(
    client: AsyncClient, clean_users_table: None
) -> None:
    ayesha, bilal = await _user(client, "ayesha"), await _user(client, "bilal")
    await _connect(client, ayesha, bilal)

    professional = await _with(client, ayesha[0], bilal[1])
    await _verify(ayesha[1], "university", "ayesha@lums.edu.pk")
    await _verify(bilal[1], "university", "bilal@lums.edu.pk")
    alumni = await _with(client, ayesha[0], bilal[1])
    await _verify(ayesha[1], "employer", "ayesha@garner.com")
    await _verify(bilal[1], "employer", "bilal@garner.com")
    both = await _with(client, ayesha[0], bilal[1])
    listed = (await client.get(URL, headers=bilal[0])).json()

    assert professional["connection_type"] == "professional"
    assert alumni["connection_type"] == "alumni"
    assert both["connection_type"] == "both"
    assert listed["items"][0]["connection_type"] == "both"


async def test_no_type_until_connected(client: AsyncClient, clean_users_table: None) -> None:
    ayesha, bilal = await _user(client, "ayesha"), await _user(client, "bilal")
    await _ask(client, ayesha[0], bilal[1])

    seen_by_bilal = await _with(client, bilal[0], ayesha[1])

    assert seen_by_bilal["status"] == "pending_received"
    assert seen_by_bilal["request_id"] is not None
    assert seen_by_bilal["connection_type"] is None


async def test_requests_are_rate_limited(
    client: AsyncClient, clean_users_table: None, limiter: RateLimiter
) -> None:
    ayesha, bilal = await _user(client, "ayesha"), await _user(client, "bilal")
    for _ in range(CONNECTION_REQUESTS_PER_USER.max_attempts):
        await limiter.hit(CONNECTION_REQUESTS_PER_USER, ayesha[1])

    response = await _ask(client, ayesha[0], bilal[1])

    assert response.status_code == 429


async def test_connections_need_a_sign_in(client: AsyncClient) -> None:
    assert (await client.get(URL)).status_code == 401
    assert (await client.post(REQUESTS_URL, json={"user_id": str(uuid.uuid4())})).status_code == 401


async def _queries_to_list(client: AsyncClient, headers: dict) -> int:
    """How many SQL statements one GET /connections runs."""
    count = 0

    def _count(*_args) -> None:
        nonlocal count
        count += 1

    event.listen(engine.sync_engine, "before_cursor_execute", _count)
    try:
        await client.get(URL, headers=headers)
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", _count)
    return count


async def test_listing_runs_the_same_queries_for_3_or_6_connections(
    client: AsyncClient, clean_users_table: None
) -> None:
    """No N+1: the person, profile and type of every row come from fixed queries."""
    me = await _user(client, "me")
    for n in range(3):
        await _connect(client, await _user(client, f"first{n}"), me)
    with_three = await _queries_to_list(client, me[0])
    for n in range(3):
        await _connect(client, await _user(client, f"second{n}"), me)
    with_six = await _queries_to_list(client, me[0])

    assert with_three == with_six
