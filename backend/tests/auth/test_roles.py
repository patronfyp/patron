"""Tests for POST /api/v1/auth/role - adding a role to your own account.

A user can hold several of candidate, referrer and recruiter; admin is never
self-assigned.
"""

from httpx import AsyncClient

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ROLE_URL = "/api/v1/auth/role"

_EMAIL = "roles@example.com"
_PASSWORD = "secret123"


async def _sign_up_as_candidate(client: AsyncClient) -> dict:
    """Register as a candidate and return the Authorization header."""
    await client.post(
        REGISTER_URL,
        json={
            "email": _EMAIL,
            "password": _PASSWORD,
            "full_name": "Role Test",
            "role": "candidate",
        },
    )
    login = await client.post(LOGIN_URL, json={"email": _EMAIL, "password": _PASSWORD})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def test_adding_a_role_keeps_the_existing_ones(
    client: AsyncClient, clean_users_table: None
) -> None:
    """The point of multi-role: an employee who job-hunts can also refer."""
    headers = await _sign_up_as_candidate(client)

    response = await client.post(ROLE_URL, json={"role": "referrer"}, headers=headers)

    assert response.status_code == 200
    assert response.json()["roles"] == ["candidate", "referrer"]


async def test_a_user_can_hold_all_three_self_chosen_roles(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_up_as_candidate(client)

    await client.post(ROLE_URL, json={"role": "recruiter"}, headers=headers)
    response = await client.post(ROLE_URL, json={"role": "referrer"}, headers=headers)

    # Always in the same order, whatever order they were added in.
    assert response.json()["roles"] == ["candidate", "referrer", "recruiter"]


async def test_adding_a_role_you_already_hold_changes_nothing(
    client: AsyncClient, clean_users_table: None
) -> None:
    """A double-submitted form must not fail or create a duplicate row."""
    headers = await _sign_up_as_candidate(client)

    response = await client.post(ROLE_URL, json={"role": "candidate"}, headers=headers)

    assert response.status_code == 200
    assert response.json()["roles"] == ["candidate"]


async def test_admin_cannot_be_self_assigned(client: AsyncClient, clean_users_table: None) -> None:
    headers = await _sign_up_as_candidate(client)

    response = await client.post(ROLE_URL, json={"role": "admin"}, headers=headers)

    assert response.status_code == 422
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.json()["roles"] == ["candidate"]


async def test_adding_a_role_requires_sign_in(client: AsyncClient) -> None:
    response = await client.post(ROLE_URL, json={"role": "referrer"})

    assert response.status_code == 401
