"""Business rules for jobs (ADR 0025): only the company's own team sees them,
interviewers can't change them, and a job moves draft -> open -> closed.

    draft --publish--> open --close--> closed --reopen--> open
                        |  (past expires_at: shown and treated as "expired")
                        +--reopen--> open (a fresh expiry)

Only a draft can be deleted: a published job may already have referrals
pointing at it, so it is closed instead.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, UnprocessableError
from app.modules.auth.models import User
from app.modules.companies import repository as companies_repository
from app.modules.companies.models import MemberRole

from . import repository
from .models import Job, JobStatus
from .schemas import MIN_DESCRIPTION, JobCreate, JobPage, JobPublish, JobRead, JobUpdate

_WRITERS = {MemberRole.OWNER, MemberRole.RECRUITER, MemberRole.HIRING_MANAGER}
# Fields that may be cleared with null while a draft; the rest are required.
_CLEARABLE = {"salary_min", "salary_max", "description", "requirements", "job_type", "level"}
# What a job must have before it can be published, and keep while open.
_NEEDED_TO_PUBLISH = {
    "description": "a description",
    "job_type": "a job type",
    "level": "a level",
}


async def _company_id(session: AsyncSession, user: User, *, write: bool) -> uuid.UUID:
    membership = await companies_repository.get_membership(session, user.id)
    if membership is None:
        raise NotFoundError("You don't belong to a company yet")
    company, member = membership
    if write and member.role not in _WRITERS:
        raise ForbiddenError("Interviewers can't change the company's jobs")
    return company.id


async def _get(session: AsyncSession, company_id: uuid.UUID, job_id: uuid.UUID) -> Job:
    job = await repository.get(session, company_id, job_id)
    if job is None:
        raise NotFoundError("No such job at your company")
    return job


def _check_salary(job: Job) -> None:
    if (
        job.salary_min is not None
        and job.salary_max is not None
        and job.salary_min > job.salary_max
    ):
        raise UnprocessableError("The minimum salary can't be more than the maximum.")


def _missing_to_publish(job: Job) -> list[str]:
    missing = [label for field, label in _NEEDED_TO_PUBLISH.items() if not getattr(job, field)]
    if (
        job.description
        and len(job.description) < MIN_DESCRIPTION
        and "a description" not in missing
    ):
        missing.append(f"a description of at least {MIN_DESCRIPTION} characters")
    return missing


def _open(job: Job, open_days: int) -> None:
    now = datetime.now(UTC)
    job.status = JobStatus.OPEN
    job.published_at = now
    job.expires_at = now + timedelta(days=open_days)
    job.closed_at = None


async def list_jobs(
    session: AsyncSession, user: User, *, status: str | None, limit: int, offset: int
) -> JobPage:
    """The company's jobs, newest first. Interviewers can read them."""
    company_id = await _company_id(session, user, write=False)
    jobs, total = await repository.list_for_company(
        session, company_id, status=status, now=datetime.now(UTC), limit=limit, offset=offset
    )
    return JobPage(items=[JobRead.model_validate(job) for job in jobs], total=total)


async def get_job(session: AsyncSession, user: User, job_id: uuid.UUID) -> JobRead:
    company_id = await _company_id(session, user, write=False)
    return JobRead.model_validate(await _get(session, company_id, job_id))


async def create_job(session: AsyncSession, user: User, payload: JobCreate) -> JobRead:
    """A new job always starts as a draft."""
    company_id = await _company_id(session, user, write=True)
    fields = payload.model_dump(mode="json", exclude_none=True)
    job = Job(company_id=company_id, created_by=user.id, **fields)
    return JobRead.model_validate(await repository.add(session, job))


async def update_job(
    session: AsyncSession, user: User, job_id: uuid.UUID, payload: JobUpdate
) -> JobRead:
    """Change only the fields sent. An open job can't lose what publishing needs."""
    company_id = await _company_id(session, user, write=True)
    job = await _get(session, company_id, job_id)
    for field, value in payload.model_dump(mode="json", exclude_unset=True).items():
        if value is None and field not in _CLEARABLE:
            raise UnprocessableError(f"{field} can't be empty")
        if field == "skills" and value is None:
            value = []
        setattr(job, field, value)
    _check_salary(job)
    if job.status == JobStatus.OPEN and (missing := _missing_to_publish(job)):
        raise UnprocessableError(f"An open job needs {', '.join(missing)}.")
    return JobRead.model_validate(await repository.save(session, job))


async def publish_job(
    session: AsyncSession, user: User, job_id: uuid.UUID, payload: JobPublish
) -> JobRead:
    """Open a draft for `open_days` days. It must have everything a posting needs."""
    company_id = await _company_id(session, user, write=True)
    job = await _get(session, company_id, job_id)
    if job.status != JobStatus.DRAFT:
        raise ConflictError("Only a draft can be published; reopen a closed job instead.")
    if missing := _missing_to_publish(job):
        raise UnprocessableError(f"To publish, add {', '.join(missing)}.")
    _open(job, payload.open_days)
    return JobRead.model_validate(await repository.save(session, job))


async def close_job(session: AsyncSession, user: User, job_id: uuid.UUID) -> JobRead:
    """Stop taking candidates. An expired job can be closed too (it then stays closed)."""
    company_id = await _company_id(session, user, write=True)
    job = await _get(session, company_id, job_id)
    if job.status != JobStatus.OPEN:
        raise ConflictError("Only an open job can be closed.")
    job.status = JobStatus.CLOSED
    job.closed_at = datetime.now(UTC)
    return JobRead.model_validate(await repository.save(session, job))


async def reopen_job(
    session: AsyncSession, user: User, job_id: uuid.UUID, payload: JobPublish
) -> JobRead:
    """Open a closed or expired job again, with a fresh expiry."""
    company_id = await _company_id(session, user, write=True)
    job = await _get(session, company_id, job_id)
    if job.status == JobStatus.DRAFT:
        raise ConflictError("A draft is published, not reopened.")
    if job.status == JobStatus.OPEN and not job.is_expired:
        raise ConflictError("This job is already open.")
    if missing := _missing_to_publish(job):
        raise UnprocessableError(f"To reopen, add {', '.join(missing)}.")
    _open(job, payload.open_days)
    return JobRead.model_validate(await repository.save(session, job))


async def delete_job(session: AsyncSession, user: User, job_id: uuid.UUID) -> None:
    """Delete a draft. A published job is closed instead, never deleted."""
    company_id = await _company_id(session, user, write=True)
    job = await _get(session, company_id, job_id)
    if job.status != JobStatus.DRAFT:
        raise ConflictError("Only a draft can be deleted; close a published job instead.")
    await repository.delete(session, job)
