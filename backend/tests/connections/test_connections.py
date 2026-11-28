"""Tests for /api/v1/connections (#119): requests, connections, mutuals and types."""

import uuid
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import update

from app.core.database import SessionLocal
from app.core.rate_limit import CONNECTION_REQUESTS_PER_USER, RateLimiter
from app.modules.connections.models import ConnectionRequest
from tests.connections.helpers import (
    REQUESTS_URL,
    URL,
    ask,
    connect,
    count_queries,
    received,
    relationship,
    user,
    verify,
)

NOTIFICATIONS_URL = "/api/v1/notifications/me"


async def test_sending_accepting_and_listing(client: AsyncClient, clean_users_table: None) -> None:
    ayesha, bilal = await user(client, "ayesha"), await user(client, "bilal")

    sent = await ask(client, ayesha[0], bilal[1])
    inbox = await received(client, bilal[0])
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
    assert await received(client, bilal[0]) == []


async def test_both_sides_are_notified(client: AsyncClient, clean_users_table: None) -> None:
    ayesha, bilal = await user(client, "ayesha"), await user(client, "bilal")

    await connect(client, ayesha, bilal)

    bilal_notes = (await client.get(NOTIFICATIONS_URL, headers=bilal[0])).json()
    ayesha_notes = (await client.get(NOTIFICATIONS_URL, headers=ayesha[0])).json()
    assert "Ayesha wants to connect" in str(bilal_notes)
    assert "Bilal accepted your request" in str(ayesha_notes)


async def test_no_request_to_yourself_twice_or_when_connected(
    client: AsyncClient, clean_users_table: None
) -> None:
    ayesha, bilal = await user(client, "ayesha"), await user(client, "bilal")

    to_self = await ask(client, ayesha[0], ayesha[1])
    to_nobody = await ask(client, ayesha[0], str(uuid.uuid4()))
    await ask(client, ayesha[0], bilal[1])
    twice = await ask(client, ayesha[0], bilal[1])
    request_id = (await received(client, bilal[0]))[0]["id"]
    await client.post(f"{REQUESTS_URL}/{request_id}/accept", headers=bilal[0])
    when_connected = await ask(client, ayesha[0], bilal[1])

    assert to_self.status_code == 422
    assert to_nobody.status_code == 404
    assert twice.status_code == 409
    assert when_connected.status_code == 409


async def test_asking_someone_who_asked_you_connects_you(
    client: AsyncClient, clean_users_table: None
) -> None:
    ayesha, bilal = await user(client, "ayesha"), await user(client, "bilal")
    await ask(client, ayesha[0], bilal[1])

    response = await ask(client, bilal[0], ayesha[1])

    assert response.status_code == 200
    assert response.json()["status"] == "connected"
    assert (await client.get(URL, headers=ayesha[0])).json()["total"] == 1


async def test_a_decline_is_never_revealed_to_the_sender(
    client: AsyncClient, clean_users_table: None
) -> None:
    ayesha, bilal = await user(client, "ayesha"), await user(client, "bilal")
    await ask(client, ayesha[0], bilal[1])
    request_id = (await received(client, bilal[0]))[0]["id"]

    declined = await client.post(f"{REQUESTS_URL}/{request_id}/decline", headers=bilal[0])
    seen_by_ayesha = await relationship(client, ayesha[0], bilal[1])
    again = await ask(client, ayesha[0], bilal[1])

    assert declined.status_code == 204
    assert await received(client, bilal[0]) == []
    assert seen_by_ayesha["status"] == "pending_sent"
    assert again.status_code == 409
    assert again.json()["detail"] == "You've already sent a request"


async def test_a_withdrawn_request_can_be_sent_again_after_30_days(
    client: AsyncClient, clean_users_table: None
) -> None:
    ayesha, bilal = await user(client, "ayesha"), await user(client, "bilal")
    request_id = (await ask(client, ayesha[0], bilal[1])).json()["request_id"]

    withdrawn = await client.delete(f"{REQUESTS_URL}/{request_id}", headers=ayesha[0])
    too_soon = await ask(client, ayesha[0], bilal[1])
    async with SessionLocal() as session:
        await session.execute(
            update(ConnectionRequest).values(responded_at=datetime.now(UTC) - timedelta(days=31))
        )
        await session.commit()
    later = await ask(client, ayesha[0], bilal[1])

    assert withdrawn.status_code == 204
    assert (await relationship(client, ayesha[0], bilal[1]))["status"] == "pending_sent"
    assert too_soon.status_code == 409
    assert later.status_code == 201
    assert len(await received(client, bilal[0])) == 1


async def test_only_the_receiver_can_accept_and_only_the_sender_can_withdraw(
    client: AsyncClient, clean_users_table: None
) -> None:
    ayesha, bilal = await user(client, "ayesha"), await user(client, "bilal")
    zara = await user(client, "zara")
    request_id = (await ask(client, ayesha[0], bilal[1])).json()["request_id"]

    accepted_by_sender = await client.post(f"{REQUESTS_URL}/{request_id}/accept", headers=ayesha[0])
    accepted_by_stranger = await client.post(f"{REQUESTS_URL}/{request_id}/accept", headers=zara[0])
    withdrawn_by_receiver = await client.delete(f"{REQUESTS_URL}/{request_id}", headers=bilal[0])

    assert accepted_by_sender.status_code == 404
    assert accepted_by_stranger.status_code == 404
    assert withdrawn_by_receiver.status_code == 404


async def test_removing_a_connection(client: AsyncClient, clean_users_table: None) -> None:
    ayesha, bilal = await user(client, "ayesha"), await user(client, "bilal")
    await connect(client, ayesha, bilal)

    removed = await client.delete(f"{URL}/{bilal[1]}", headers=ayesha[0])
    again = await client.delete(f"{URL}/{bilal[1]}", headers=ayesha[0])

    assert removed.status_code == 204
    assert again.status_code == 404
    assert (await client.get(URL, headers=bilal[0])).json()["total"] == 0
    assert (await relationship(client, ayesha[0], bilal[1]))["status"] == "none"


async def test_the_list_is_paged_and_searchable(
    client: AsyncClient, clean_users_table: None
) -> None:
    me = await user(client, "me")
    for name in ("ayesha", "bilal", "sara"):
        await connect(client, await user(client, name), me)

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
    ayesha, bilal = await user(client, "ayesha"), await user(client, "bilal")
    sara, zara, omar = (
        await user(client, "sara"),
        await user(client, "zara"),
        await user(client, "omar"),
    )
    for friend in (sara, zara, omar):
        await connect(client, ayesha, friend)
    for friend in (sara, zara):
        await connect(client, bilal, friend)

    seen = await relationship(client, ayesha[0], bilal[1])

    assert seen["status"] == "none"
    assert seen["mutual_count"] == 2
    assert [person["full_name"] for person in seen["mutual"]] == ["Sara", "Zara"]


async def test_the_connection_type_comes_from_verified_emails(
    client: AsyncClient, clean_users_table: None
) -> None:
    ayesha, bilal = await user(client, "ayesha"), await user(client, "bilal")
    await connect(client, ayesha, bilal)

    professional = await relationship(client, ayesha[0], bilal[1])
    await verify(ayesha[1], "university", "ayesha@lums.edu.pk")
    await verify(bilal[1], "university", "bilal@lums.edu.pk")
    alumni = await relationship(client, ayesha[0], bilal[1])
    await verify(ayesha[1], "employer", "ayesha@garner.com")
    await verify(bilal[1], "employer", "bilal@garner.com")
    both = await relationship(client, ayesha[0], bilal[1])
    listed = (await client.get(URL, headers=bilal[0])).json()

    assert professional["connection_type"] == "professional"
    assert alumni["connection_type"] == "alumni"
    assert both["connection_type"] == "both"
    assert listed["items"][0]["connection_type"] == "both"


async def test_no_type_until_connected(client: AsyncClient, clean_users_table: None) -> None:
    ayesha, bilal = await user(client, "ayesha"), await user(client, "bilal")
    await ask(client, ayesha[0], bilal[1])

    seen_by_bilal = await relationship(client, bilal[0], ayesha[1])

    assert seen_by_bilal["status"] == "pending_received"
    assert seen_by_bilal["request_id"] is not None
    assert seen_by_bilal["connection_type"] is None


async def test_requests_are_rate_limited(
    client: AsyncClient, clean_users_table: None, limiter: RateLimiter
) -> None:
    ayesha, bilal = await user(client, "ayesha"), await user(client, "bilal")
    for _ in range(CONNECTION_REQUESTS_PER_USER.max_attempts):
        await limiter.hit(CONNECTION_REQUESTS_PER_USER, ayesha[1])

    response = await ask(client, ayesha[0], bilal[1])

    assert response.status_code == 429


async def test_connections_need_a_sign_in(client: AsyncClient) -> None:
    assert (await client.get(URL)).status_code == 401
    assert (await client.post(REQUESTS_URL, json={"user_id": str(uuid.uuid4())})).status_code == 401


async def test_listing_runs_the_same_queries_for_3_or_6_connections(
    client: AsyncClient, clean_users_table: None
) -> None:
    """No N+1: the person, profile and type of every row come from fixed queries."""
    me = await user(client, "me")
    for n in range(3):
        await connect(client, await user(client, f"first{n}"), me)
    with_three = await count_queries(client, URL, me[0])
    for n in range(3):
        await connect(client, await user(client, f"second{n}"), me)
    with_six = await count_queries(client, URL, me[0])

    assert with_three == with_six


async def test_the_list_shows_mutual_counts(client: AsyncClient, clean_users_table: None) -> None:
    me, bilal, sara = (
        await user(client, "me"),
        await user(client, "bilal"),
        await user(client, "sara"),
    )
    zara, omar = await user(client, "zara"), await user(client, "omar")
    for friend in (bilal, sara, zara, omar):
        await connect(client, me, friend)
    # Bilal knows Sara and Zara; Sara knows Bilal; Omar knows none of mine.
    await connect(client, bilal, sara)
    await connect(client, bilal, zara)

    items = (await client.get(URL, headers=me[0])).json()["items"]
    counts = {item["person"]["full_name"]: item["mutual_count"] for item in items}

    assert counts == {"Bilal": 2, "Sara": 1, "Zara": 1, "Omar": 0}
