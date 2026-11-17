"""Tests for the recruiter wizard's step count (#106): 4 steps for a recruiter
who sets up a company, 1 for an invited hiring manager or interviewer."""

from httpx import AsyncClient

from tests.companies.helpers import garner_owner, join_garner, sign_up
from tests.fakes import RecordingSender

PROFILE_URL = "/api/v1/profile/me"
COMPLETE_URL = f"{PROFILE_URL}/onboarding/complete"


async def _go_to_step(client: AsyncClient, headers: dict, last: int) -> list[int]:
    """Walk the wizard forward; return each response's status."""
    return [
        (
            await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": step})
        ).status_code
        for step in range(2, last + 1)
    ]


async def test_a_recruiter_wizard_has_four_steps(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)

    walked = await _go_to_step(client, owner, 4)
    too_far = await client.patch(PROFILE_URL, headers=owner, json={"onboarding_step": 5})
    finished = await client.post(COMPLETE_URL, headers=owner)

    assert walked == [200, 200, 200]
    assert too_far.status_code == 422
    assert finished.status_code == 200
    assert finished.json()["onboarding_completed"] is True


async def test_a_recruiter_cannot_finish_without_a_company(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await sign_up(client, "solo@example.com")
    await _go_to_step(client, headers, 4)

    response = await client.post(COMPLETE_URL, headers=headers)

    assert response.status_code == 422
    assert "company" in response.json()["detail"]


async def test_a_recruiter_cannot_finish_before_the_last_step(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    await _go_to_step(client, owner, 3)

    response = await client.post(COMPLETE_URL, headers=owner)

    assert response.status_code == 422


async def test_an_invited_teammate_finishes_on_step_one(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    for email, role in (("bilal@garner.com", "hiring_manager"), ("sara@garner.com", "interviewer")):
        teammate = await join_garner(client, owner, sender, email, role)

        next_step = await client.patch(PROFILE_URL, headers=teammate, json={"onboarding_step": 2})
        finished = await client.post(COMPLETE_URL, headers=teammate)

        assert next_step.status_code == 422
        assert finished.status_code == 200


async def test_an_invited_recruiter_still_gets_four_steps(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    recruiter = await join_garner(client, owner, sender, "hina@garner.com", "recruiter")

    early = await client.post(COMPLETE_URL, headers=recruiter)
    await _go_to_step(client, recruiter, 4)
    finished = await client.post(COMPLETE_URL, headers=recruiter)

    assert early.status_code == 422
    assert finished.status_code == 200
