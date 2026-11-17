"""Business rules for jobs: only the company's own team sees them, and
interviewers can't change them."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError, UnprocessableError
from app.modules.auth.models import User
from app.modules.companies import repository as companies_repository
from app.modules.companies.models import MemberRole

from . import repository
from .models import Job
from .schemas import JobCreate, JobRead, JobUpdate

_WRITERS = {MemberRole.OWNER, MemberRole.RECRUITER, MemberRole.HIRING_MANAGER}
# Fields that may be cleared with null; the rest are required.
_CLEARABLE = {"salary_min", "salary_max"}
# Capped, never unbounded. Paging comes with the jobs board (Sprint 5).
MAX_JOBS_LISTED = 200


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


async def list_jobs(session: AsyncSession, user: User) -> list[JobRead]:
    company_id = await _company_id(session, user, write=False)
    jobs = await repository.list_for_company(session, company_id, MAX_JOBS_LISTED)
    return [JobRead.model_validate(job) for job in jobs]


async def create_job(session: AsyncSession, user: User, payload: JobCreate) -> JobRead:
    """A new job always starts as a draft."""
    company_id = await _company_id(session, user, write=True)
    job = Job(
        company_id=company_id,
        created_by=user.id,
        **payload.model_dump(mode="json"),
    )
    return JobRead.model_validate(await repository.add(session, job))


async def update_job(
    session: AsyncSession, user: User, job_id: uuid.UUID, payload: JobUpdate
) -> JobRead:
    """Change only the fields sent; the salary range is checked on the result."""
    company_id = await _company_id(session, user, write=True)
    job = await _get(session, company_id, job_id)
    for field, value in payload.model_dump(mode="json", exclude_unset=True).items():
        if value is None and field not in _CLEARABLE:
            raise UnprocessableError(f"{field} can't be empty")
        setattr(job, field, value.strip() if isinstance(value, str) else value)
    if (
        job.salary_min is not None
        and job.salary_max is not None
        and job.salary_min > job.salary_max
    ):
        raise UnprocessableError("The minimum salary can't be more than the maximum.")
    if not job.title or not job.location:
        raise UnprocessableError("Title and location can't be empty")
    return JobRead.model_validate(await repository.save(session, job))


async def delete_job(session: AsyncSession, user: User, job_id: uuid.UUID) -> None:
    company_id = await _company_id(session, user, write=True)
    await repository.delete(session, await _get(session, company_id, job_id))
