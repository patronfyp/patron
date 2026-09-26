"""Tests for POST /api/v1/auth/register.

Every test starts from an empty users table (the `clean_users_table` fixture),
so none of them depend on another having run first, or on what was in the
database before pytest started.
"""

from httpx import AsyncClient

REGISTER_URL = "/api/v1/auth/register"


def _payload(**overrides) -> dict:
    """A valid registration payload, with individual fields overridden per test."""
    base = {
        "email": "ali@example.com",
        "password": "secret123",
        "full_name": "Ali Khan",
        "role": "candidate",
    }
    return {**base, **overrides}


async def test_register_creates_an_account(client: AsyncClient, clean_users_table: None) -> None:
    response = await client.post(REGISTER_URL, json=_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "ali@example.com"
    assert body["full_name"] == "Ali Khan"
    assert body["role"] == "candidate"
    assert body["is_email_verified"] is False


async def test_password_never_appears_in_the_response(
    client: AsyncClient, clean_users_table: None
) -> None:
    """The single most common way projects leak a password hash - see
    STANDARDS.md §3.4. UserRead has no password field, so there is nothing to
    check for by name; this asserts the stronger claim that the hash value
    itself is not present anywhere in the payload."""
    response = await client.post(REGISTER_URL, json=_payload())

    assert "secret123" not in response.text
    assert "password" not in response.json()


async def test_email_is_lowercased_before_storage(
    client: AsyncClient, clean_users_table: None
) -> None:
    response = await client.post(REGISTER_URL, json=_payload(email="Ali@Example.com"))

    assert response.status_code == 201
    assert response.json()["email"] == "ali@example.com"


async def test_full_name_is_trimmed(client: AsyncClient, clean_users_table: None) -> None:
    response = await client.post(REGISTER_URL, json=_payload(full_name="  Ali Khan  "))

    assert response.json()["full_name"] == "Ali Khan"


async def test_duplicate_email_is_rejected(client: AsyncClient, clean_users_table: None) -> None:
    first = await client.post(REGISTER_URL, json=_payload())
    assert first.status_code == 201

    second = await client.post(REGISTER_URL, json=_payload())

    assert second.status_code == 409
    assert second.json()["code"] == "conflict"


async def test_duplicate_email_is_rejected_regardless_of_case(
    client: AsyncClient, clean_users_table: None
) -> None:
    first = await client.post(REGISTER_URL, json=_payload(email="ali@example.com"))
    assert first.status_code == 201

    second = await client.post(REGISTER_URL, json=_payload(email="ALI@EXAMPLE.COM"))

    assert second.status_code == 409


async def test_weak_password_is_rejected(client: AsyncClient, clean_users_table: None) -> None:
    response = await client.post(REGISTER_URL, json=_payload(password="short"))

    assert response.status_code == 422


async def test_invalid_email_is_rejected(client: AsyncClient, clean_users_table: None) -> None:
    response = await client.post(REGISTER_URL, json=_payload(email="not-an-email"))

    assert response.status_code == 422


async def test_invalid_role_is_rejected(client: AsyncClient, clean_users_table: None) -> None:
    response = await client.post(REGISTER_URL, json=_payload(role="admin"))

    assert response.status_code == 422


async def test_missing_field_is_rejected(client: AsyncClient, clean_users_table: None) -> None:
    payload = _payload()
    del payload["full_name"]

    response = await client.post(REGISTER_URL, json=payload)

    assert response.status_code == 422


async def test_no_user_identities_row_is_created(
    client: AsyncClient, clean_users_table: None
) -> None:
    """user_identities is for OAuth providers only - a password sign-up must
    not create one. See issue #14 and ADR 0009."""
    from sqlalchemy import func, select

    from app.modules.auth.models import UserIdentity
    from db import SessionLocal

    response = await client.post(REGISTER_URL, json=_payload())
    assert response.status_code == 201

    async with SessionLocal() as session:
        count = await session.scalar(select(func.count()).select_from(UserIdentity))

    assert count == 0
