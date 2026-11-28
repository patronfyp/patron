"""Tests for publishing, closing, reopening and expiring jobs (#129, ADR 0025)."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import update

from app.core.database import SessionLocal
from app.modules.jobs.models import Job
from tests.companies.helpers import garner_owner, join_garner
from tests.fakes import RecordingSender

JOBS_URL = "/api/v1/companies/me/jobs"

DRAFT = {"title": "Backend Engineer", "location": "Lahore", "work_mode": "hybrid"}
POSTING = {
    "description": "Build and run the APIs behind our payments product, with a small team. " * 2,
    "requirements": "3+ years of Python",
    "job_type": "full_time",
    "level": "mid",
    "skills": ["Python", " FastAPI ", "python", ""],
}


async def _draft(client: AsyncClient, headers: dict, **fields) -> dict:
    return (await client.post(JOBS_URL, headers=headers, json={**DRAFT, **fields})).json()


async def _publish(client: AsyncClient, headers: dict, job_id: str, **body):
    return await client.post(f"{JOBS_URL}/{job_id}/publish", headers=headers, json=body)


async def _expire(job_id: str) -> None:
    """Move a job's expiry into the past."""
    async with SessionLocal() as session:
        await session.execute(
            update(Job)
            .where(Job.id == job_id)
            .values(expires_at=datetime.now(UTC) - timedelta(minutes=1))
        )
        await session.commit()


async def test_a_draft_takes_the_full_posting_and_cleans_skills(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)

    job = await _draft(client, owner, **POSTING)

    assert job["status"] == "draft"
    assert job["job_type"] == "full_time"
    assert job["level"] == "mid"
    assert job["skills"] == ["Python", "FastAPI"]
    assert job["published_at"] is None


async def test_publishing_needs_the_full_posting(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    job = await _draft(client, owner)

    missing = await _publish(client, owner, job["id"])
    await client.patch(
        f"{JOBS_URL}/{job['id']}", headers=owner, json={**POSTING, "description": "Too short."}
    )
    short = await _publish(client, owner, job["id"])

    assert missing.status_code == 422
    assert "a description" in missing.json()["detail"]
    assert "a job type" in missing.json()["detail"]
    assert short.status_code == 422
    assert "at least 50 characters" in short.json()["detail"]


async def test_publishing_opens_the_job_for_30_days_by_default(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    job = await _draft(client, owner, **POSTING)

    published = await _publish(client, owner, job["id"])
    again = await _publish(client, owner, job["id"])

    body = published.json()
    opened = datetime.fromisoformat(body["published_at"])
    expires = datetime.fromisoformat(body["expires_at"])
    assert published.status_code == 200
    assert body["status"] == "open"
    assert timedelta(days=29, hours=23) < expires - opened <= timedelta(days=30)
    assert again.status_code == 409


async def test_the_recruiter_picks_7_to_90_days(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    job = await _draft(client, owner, **POSTING)

    too_short = await _publish(client, owner, job["id"], open_days=3)
    too_long = await _publish(client, owner, job["id"], open_days=120)
    week = await _publish(client, owner, job["id"], open_days=7)

    opened = datetime.fromisoformat(week.json()["published_at"])
    expires = datetime.fromisoformat(week.json()["expires_at"])
    assert too_short.status_code == 422
    assert too_long.status_code == 422
    assert expires - opened <= timedelta(days=7)


async def test_an_open_job_keeps_what_publishing_needs(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    job = await _draft(client, owner, **POSTING)
    await _publish(client, owner, job["id"])

    cleared = await client.patch(f"{JOBS_URL}/{job['id']}", headers=owner, json={"level": None})
    edited = await client.patch(f"{JOBS_URL}/{job['id']}", headers=owner, json={"openings": 3})

    assert cleared.status_code == 422
    assert edited.status_code == 200
    assert edited.json()["status"] == "open"


async def test_closing_and_reopening(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    job = await _draft(client, owner, **POSTING)
    await _publish(client, owner, job["id"])

    closed = await client.post(f"{JOBS_URL}/{job['id']}/close", headers=owner)
    closed_again = await client.post(f"{JOBS_URL}/{job['id']}/close", headers=owner)
    reopened = await client.post(f"{JOBS_URL}/{job['id']}/reopen", headers=owner, json={})
    reopened_again = await client.post(f"{JOBS_URL}/{job['id']}/reopen", headers=owner)

    assert closed.json()["status"] == "closed"
    assert closed.json()["closed_at"] is not None
    assert closed_again.status_code == 409
    assert reopened.json()["status"] == "open"
    assert reopened.json()["closed_at"] is None
    assert reopened_again.status_code == 409


async def test_a_job_past_its_date_is_expired_and_can_be_reopened(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    job = await _draft(client, owner, **POSTING)
    await _publish(client, owner, job["id"])

    await _expire(job["id"])
    seen = await client.get(f"{JOBS_URL}/{job['id']}", headers=owner)
    reopened = await client.post(f"{JOBS_URL}/{job['id']}/reopen", headers=owner)

    assert seen.json()["status"] == "expired"
    assert reopened.json()["status"] == "open"
    assert datetime.fromisoformat(reopened.json()["expires_at"]) > datetime.now(UTC)


async def test_only_a_draft_can_be_deleted(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    job = await _draft(client, owner, **POSTING)
    await _publish(client, owner, job["id"])

    deleted = await client.delete(f"{JOBS_URL}/{job['id']}", headers=owner)

    assert deleted.status_code == 409
    assert "close" in deleted.json()["detail"]


async def test_the_list_filters_by_status_and_pages(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    draft = await _draft(client, owner, title="Draft role")
    opened = await _draft(client, owner, title="Open role", **POSTING)
    expired = await _draft(client, owner, title="Expired role", **POSTING)
    closed = await _draft(client, owner, title="Closed role", **POSTING)
    for job in (opened, expired, closed):
        await _publish(client, owner, job["id"])
    await client.post(f"{JOBS_URL}/{closed['id']}/close", headers=owner)
    await _expire(expired["id"])

    def titles(page: dict) -> list[str]:
        return [job["title"] for job in page["items"]]

    async def by_status(value: str) -> dict:
        return (await client.get(JOBS_URL, headers=owner, params={"status": value})).json()

    first = (await client.get(JOBS_URL, headers=owner, params={"limit": 2})).json()
    second = (await client.get(JOBS_URL, headers=owner, params={"limit": 2, "offset": 2})).json()

    assert titles(await by_status("draft")) == ["Draft role"]
    assert titles(await by_status("open")) == ["Open role"]
    assert titles(await by_status("expired")) == ["Expired role"]
    assert titles(await by_status("closed")) == ["Closed role"]
    assert first["total"] == 4
    assert len(first["items"]) == 2
    # Newest first.
    assert titles(first) + titles(second) == [
        "Closed role",
        "Expired role",
        "Open role",
        "Draft role",
    ]
    assert draft["id"] in {job["id"] for job in second["items"]}


async def test_an_interviewer_cannot_publish_close_or_reopen(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    job = await _draft(client, owner, **POSTING)
    interviewer = await join_garner(client, owner, sender, "sara@garner.com", "interviewer")

    publish = await _publish(client, interviewer, job["id"])
    await _publish(client, owner, job["id"])
    close = await client.post(f"{JOBS_URL}/{job['id']}/close", headers=interviewer)
    seen = await client.get(f"{JOBS_URL}/{job['id']}", headers=interviewer)

    assert publish.status_code == 403
    assert close.status_code == 403
    assert seen.status_code == 200
