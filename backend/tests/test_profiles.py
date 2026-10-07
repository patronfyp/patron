"""Tests for GET and PATCH /api/v1/profile/me - Modules 1.4 and 1.5."""

from httpx import AsyncClient

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
PROFILE_URL = "/api/v1/profile/me"

_PASSWORD = "secret123"


async def _sign_in(client: AsyncClient, email: str = "profile-test@example.com") -> dict:
    """Register a user, log in, and return the Authorization header."""
    await client.post(
        REGISTER_URL,
        json={
            "email": email,
            "password": _PASSWORD,
            "full_name": "Profile Test",
            "role": "candidate",
        },
    )
    login = await client.post(LOGIN_URL, json={"email": email, "password": _PASSWORD})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def test_profile_requires_a_token(client: AsyncClient, clean_users_table: None) -> None:
    assert (await client.get(PROFILE_URL)).status_code == 401
    assert (await client.patch(PROFILE_URL, json={"degree": "BSc"})).status_code == 401


async def test_first_read_returns_an_empty_profile_at_step_one(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)

    response = await client.get(PROFILE_URL, headers=headers)

    assert response.status_code == 200
    assert response.json() == {
        "university": None,
        "degree": None,
        "graduation_year": None,
        "employer_name": None,
        "onboarding_step": 1,
    }


async def test_patch_saves_fields_and_get_returns_them(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)

    patch = await client.patch(
        PROFILE_URL,
        headers=headers,
        json={
            "university": "LUMS",
            "degree": "BSc Computer Science",
            "graduation_year": 2026,
            "employer_name": "Garner",
        },
    )
    stored = await client.get(PROFILE_URL, headers=headers)

    assert patch.status_code == 200
    assert stored.json() == patch.json()
    assert stored.json()["university"] == "LUMS"
    assert stored.json()["graduation_year"] == 2026


async def test_patch_changes_only_the_fields_sent(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)
    await client.patch(PROFILE_URL, headers=headers, json={"university": "LUMS", "degree": "BSc"})

    response = await client.patch(PROFILE_URL, headers=headers, json={"degree": "MSc"})

    assert response.json()["university"] == "LUMS"
    assert response.json()["degree"] == "MSc"


async def test_patch_null_clears_a_field(client: AsyncClient, clean_users_table: None) -> None:
    headers = await _sign_in(client)
    await client.patch(PROFILE_URL, headers=headers, json={"employer_name": "Garner"})

    response = await client.patch(PROFILE_URL, headers=headers, json={"employer_name": None})

    assert response.json()["employer_name"] is None


async def test_text_fields_are_trimmed(client: AsyncClient, clean_users_table: None) -> None:
    headers = await _sign_in(client)

    response = await client.patch(PROFILE_URL, headers=headers, json={"university": "  LUMS  "})

    assert response.json()["university"] == "LUMS"


async def test_implausible_graduation_year_is_rejected(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)

    too_old = await client.patch(PROFILE_URL, headers=headers, json={"graduation_year": 1900})
    too_far = await client.patch(PROFILE_URL, headers=headers, json={"graduation_year": 2999})

    assert too_old.status_code == 422
    assert too_far.status_code == 422


async def test_unknown_field_is_rejected(client: AsyncClient, clean_users_table: None) -> None:
    headers = await _sign_in(client)

    response = await client.patch(PROFILE_URL, headers=headers, json={"universty": "LUMS"})

    assert response.status_code == 422


async def test_step_can_advance_by_one(client: AsyncClient, clean_users_table: None) -> None:
    headers = await _sign_in(client)

    response = await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": 2})

    assert response.status_code == 200
    assert response.json()["onboarding_step"] == 2


async def test_step_cannot_skip_ahead(client: AsyncClient, clean_users_table: None) -> None:
    headers = await _sign_in(client)

    response = await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": 4})

    assert response.status_code == 422
    stored = await client.get(PROFILE_URL, headers=headers)
    assert stored.json()["onboarding_step"] == 1


async def test_step_can_go_back(client: AsyncClient, clean_users_table: None) -> None:
    headers = await _sign_in(client)
    await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": 2})
    await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": 3})

    response = await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": 1})

    assert response.status_code == 200
    assert response.json()["onboarding_step"] == 1


async def test_step_is_limited_to_the_seven_steps(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)

    too_high = await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": 8})
    zero = await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": 0})

    assert too_high.status_code == 422
    assert zero.status_code == 422


async def test_step_is_remembered_across_sessions(
    client: AsyncClient, clean_users_table: None
) -> None:
    """The resume case: save & exit, log in again later, land on the same step."""
    first = await _sign_in(client)
    await client.patch(PROFILE_URL, headers=first, json={"onboarding_step": 2})

    login = await client.post(
        LOGIN_URL, json={"email": "profile-test@example.com", "password": _PASSWORD}
    )
    second = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = await client.get(PROFILE_URL, headers=second)

    assert response.json()["onboarding_step"] == 2


async def test_users_only_see_their_own_profile(
    client: AsyncClient, clean_users_table: None
) -> None:
    alice = await _sign_in(client, "alice@example.com")
    bob = await _sign_in(client, "bob@example.com")
    await client.patch(PROFILE_URL, headers=alice, json={"university": "LUMS"})

    response = await client.get(PROFILE_URL, headers=bob)

    assert response.json()["university"] is None
