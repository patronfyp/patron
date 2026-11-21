"""Tests for GET /api/v1/people (#120): finding people to connect with."""

from httpx import AsyncClient

from app.core.rate_limit import PEOPLE_SEARCH_PER_USER, RateLimiter
from tests.connections.helpers import (
    PEOPLE_URL,
    ask,
    connect,
    count_queries,
    received,
    user,
    verify,
)


async def _search(client: AsyncClient, headers: dict, q: str):
    return await client.get(PEOPLE_URL, headers=headers, params={"q": q})


async def _names(client: AsyncClient, headers: dict, q: str) -> list[str]:
    return [person["full_name"] for person in (await _search(client, headers, q)).json()]


async def test_matches_name_job_title_company_and_university(
    client: AsyncClient, clean_users_table: None
) -> None:
    me = await user(client, "me")
    await user(client, "bilal", job_title="Backend Engineer")
    await user(client, "sara", employer_name="Garner")
    await user(client, "zara", university="LUMS")

    assert await _names(client, me[0], "BIL") == ["Bilal"]
    assert await _names(client, me[0], "backend") == ["Bilal"]
    assert await _names(client, me[0], "garn") == ["Sara"]
    assert await _names(client, me[0], "lums") == ["Zara"]
    assert await _names(client, me[0], "nobody") == []


async def test_names_that_start_with_the_query_come_first(
    client: AsyncClient, clean_users_table: None
) -> None:
    me = await user(client, "me")
    await user(client, "zali")  # "ali" in the middle
    await user(client, "alina")  # starts with "ali"

    assert await _names(client, me[0], "ali") == ["Alina", "Zali"]


async def test_never_me_and_never_emails(client: AsyncClient, clean_users_table: None) -> None:
    me = await user(client, "bilal")
    await user(client, "bilalkhan")

    results = (await _search(client, me[0], "bilal")).json()

    assert [person["full_name"] for person in results] == ["Bilalkhan"]
    assert "email" not in results[0]
    assert "@example.com" not in str(results)


async def test_each_result_says_where_i_stand(client: AsyncClient, clean_users_table: None) -> None:
    me = await user(client, "me")
    friend, asked, asker, stranger = (
        await user(client, "team-friend"),
        await user(client, "team-asked"),
        await user(client, "team-asker"),
        await user(client, "team-stranger"),
    )
    await connect(client, me, friend)
    await ask(client, me[0], asked[1])
    await ask(client, asker[0], me[1])
    asker_request = (await received(client, me[0]))[0]["id"]

    results = {
        person["full_name"]: person for person in (await _search(client, me[0], "team")).json()
    }

    assert results["Team-friend"]["relationship"] == "connected"
    assert results["Team-asked"]["relationship"] == "pending_sent"
    assert results["Team-asker"]["relationship"] == "pending_received"
    assert results["Team-asker"]["request_id"] == asker_request
    assert results["Team-stranger"]["relationship"] == "none"
    assert results["Team-stranger"]["request_id"] is None
    assert stranger[1] == results["Team-stranger"]["user_id"]


async def test_verified_badges(client: AsyncClient, clean_users_table: None) -> None:
    me = await user(client, "me")
    bilal = await user(client, "bilal")
    await verify(bilal[1], "employer", "bilal@garner.com")

    result = (await _search(client, me[0], "bilal")).json()[0]

    assert result["employer_verified"] is True
    assert result["university_verified"] is False


async def test_at_least_2_characters_and_at_most_20_results(
    client: AsyncClient, clean_users_table: None
) -> None:
    me = await user(client, "me")
    for n in range(22):
        await user(client, f"member{n:02d}")

    one_letter = await _search(client, me[0], "m")
    spaces = await _search(client, me[0], "   a  ")
    many = await _search(client, me[0], "member")

    assert one_letter.status_code == 422
    assert spaces.json() == []
    assert len(many.json()) == 20


async def test_wildcards_are_plain_text(client: AsyncClient, clean_users_table: None) -> None:
    me = await user(client, "me")
    await user(client, "bilal")

    assert await _names(client, me[0], "%%") == []
    assert await _names(client, me[0], "__") == []


async def test_searches_are_rate_limited(
    client: AsyncClient, clean_users_table: None, limiter: RateLimiter
) -> None:
    me = await user(client, "me")
    for _ in range(PEOPLE_SEARCH_PER_USER.max_attempts):
        await limiter.hit(PEOPLE_SEARCH_PER_USER, me[1])

    assert (await _search(client, me[0], "bilal")).status_code == 429


async def test_search_needs_a_sign_in(client: AsyncClient) -> None:
    assert (await client.get(PEOPLE_URL, params={"q": "bilal"})).status_code == 401


async def test_search_runs_the_same_queries_for_3_or_12_results(
    client: AsyncClient, clean_users_table: None
) -> None:
    """No N+1: relationships and badges for every result come from fixed queries."""
    me = await user(client, "me")
    for n in range(3):
        await connect(client, me, await user(client, f"few{n}"))
    for n in range(12):
        await connect(client, me, await user(client, f"many{n:02d}"))

    with_three = await count_queries(client, PEOPLE_URL, me[0], q="few")
    with_twelve = await count_queries(client, PEOPLE_URL, me[0], q="many")

    assert with_three == with_twelve
