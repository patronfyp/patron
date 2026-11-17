"""Tests for /api/v1/companies/me/jobs (#106): a company's draft jobs."""

from httpx import AsyncClient

from tests.companies.helpers import (
    COMPANY_URL,
    GARNER,
    garner_owner,
    join_garner,
    sign_up,
    verified_recruiter,
)
from tests.fakes import RecordingSender

JOBS_URL = "/api/v1/companies/me/jobs"

BACKEND = {
    "title": "  Senior Backend Engineer ",
    "location": "Lahore",
    "work_mode": "hybrid",
    "salary_min": 300000,
    "salary_max": 450000,
    "openings": 2,
}


async def test_a_new_job_is_a_draft_and_is_listed(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)

    created = await client.post(JOBS_URL, headers=owner, json=BACKEND)
    listed = await client.get(JOBS_URL, headers=owner)

    assert created.status_code == 201
    body = created.json()
    assert body["title"] == "Senior Backend Engineer"
    assert body["status"] == "draft"
    assert body["openings"] == 2
    assert [job["id"] for job in listed.json()] == [body["id"]]


async def test_clients_cannot_set_the_status(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)

    response = await client.post(JOBS_URL, headers=owner, json={**BACKEND, "status": "open"})

    assert response.status_code == 422


async def test_the_salary_range_must_be_in_order(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    job = (await client.post(JOBS_URL, headers=owner, json=BACKEND)).json()

    bad_create = await client.post(
        JOBS_URL, headers=owner, json={**BACKEND, "salary_min": 500000, "salary_max": 100000}
    )
    bad_update = await client.patch(
        f"{JOBS_URL}/{job['id']}", headers=owner, json={"salary_min": 900000}
    )

    assert bad_create.status_code == 422
    assert bad_update.status_code == 422


async def test_updating_changes_only_the_fields_sent(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    job = (await client.post(JOBS_URL, headers=owner, json=BACKEND)).json()

    updated = await client.patch(
        f"{JOBS_URL}/{job['id']}", headers=owner, json={"work_mode": "remote", "salary_max": None}
    )
    cleared_title = await client.patch(
        f"{JOBS_URL}/{job['id']}", headers=owner, json={"title": None}
    )

    assert updated.status_code == 200
    assert updated.json()["work_mode"] == "remote"
    assert updated.json()["salary_max"] is None
    assert updated.json()["title"] == "Senior Backend Engineer"
    assert cleared_title.status_code == 422


async def test_deleting_a_job(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    job = (await client.post(JOBS_URL, headers=owner, json=BACKEND)).json()

    deleted = await client.delete(f"{JOBS_URL}/{job['id']}", headers=owner)
    again = await client.delete(f"{JOBS_URL}/{job['id']}", headers=owner)

    assert deleted.status_code == 204
    assert again.status_code == 404
    assert (await client.get(JOBS_URL, headers=owner)).json() == []


async def test_a_hiring_manager_can_add_jobs(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    manager = await join_garner(client, owner, sender, "bilal@garner.com", "hiring_manager")

    response = await client.post(JOBS_URL, headers=manager, json=BACKEND)

    assert response.status_code == 201


async def test_an_interviewer_can_read_but_not_change_jobs(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    job = (await client.post(JOBS_URL, headers=owner, json=BACKEND)).json()
    interviewer = await join_garner(client, owner, sender, "sara@garner.com", "interviewer")

    listed = await client.get(JOBS_URL, headers=interviewer)
    created = await client.post(JOBS_URL, headers=interviewer, json=BACKEND)
    updated = await client.patch(
        f"{JOBS_URL}/{job['id']}", headers=interviewer, json={"openings": 5}
    )
    deleted = await client.delete(f"{JOBS_URL}/{job['id']}", headers=interviewer)

    assert len(listed.json()) == 1
    assert created.status_code == 403
    assert updated.status_code == 403
    assert deleted.status_code == 403


async def test_jobs_need_a_company(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    loner = await sign_up(client, "loner@example.com")

    assert (await client.get(JOBS_URL)).status_code == 401
    assert (await client.get(JOBS_URL, headers=loner)).status_code == 404
    assert (await client.post(JOBS_URL, headers=loner, json=BACKEND)).status_code == 404


async def test_another_company_cannot_touch_my_jobs(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    job = (await client.post(JOBS_URL, headers=owner, json=BACKEND)).json()
    rival = await verified_recruiter(client, sender, "zara@rival.pk")
    await client.post(COMPANY_URL, headers=rival, json={**GARNER, "website": "rival.pk"})

    updated = await client.patch(f"{JOBS_URL}/{job['id']}", headers=rival, json={"openings": 9})
    deleted = await client.delete(f"{JOBS_URL}/{job['id']}", headers=rival)
    listed = await client.get(JOBS_URL, headers=rival)

    assert updated.status_code == 404
    assert deleted.status_code == 404
    assert listed.json() == []
