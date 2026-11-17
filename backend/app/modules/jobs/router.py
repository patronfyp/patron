"""Job endpoints for the signed-in user's company."""

import uuid

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, SessionDep

from . import service
from .schemas import JobCreate, JobRead, JobUpdate

router = APIRouter(prefix="/companies/me/jobs", tags=["jobs"])

_UNAUTHORIZED = {401: {"description": "Missing, invalid or expired access token"}}
_NO_COMPANY = {404: {"description": "You don't belong to a company yet"}}
_NOT_WRITER = {403: {"description": "Interviewers can't change jobs"}}
_NO_JOB = {404: {"description": "No company, or no such job at it"}}


@router.get(
    "",
    response_model=list[JobRead],
    summary="List my company's jobs",
    responses={**_UNAUTHORIZED, **_NO_COMPANY},
)
async def list_jobs(current_user: CurrentUser, session: SessionDep) -> list[JobRead]:
    """Every job at your company, oldest first (at most 200)."""
    return await service.list_jobs(session, current_user)


@router.post(
    "",
    response_model=JobRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a job",
    responses={
        **_UNAUTHORIZED,
        **_NO_COMPANY,
        **_NOT_WRITER,
        422: {"description": "Invalid fields, or minimum salary above maximum"},
    },
)
async def create_job(payload: JobCreate, current_user: CurrentUser, session: SessionDep) -> JobRead:
    """Add a role your company is hiring for. It starts as a draft."""
    return await service.create_job(session, current_user, payload)


@router.patch(
    "/{job_id}",
    response_model=JobRead,
    summary="Update a job",
    responses={
        **_UNAUTHORIZED,
        **_NO_JOB,
        **_NOT_WRITER,
        422: {"description": "Invalid fields, or minimum salary above maximum"},
    },
)
async def update_job(
    job_id: uuid.UUID, payload: JobUpdate, current_user: CurrentUser, session: SessionDep
) -> JobRead:
    """Change only the fields sent. Send null to clear a salary end."""
    return await service.update_job(session, current_user, job_id, payload)


@router.delete(
    "/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a job",
    responses={**_UNAUTHORIZED, **_NO_JOB, **_NOT_WRITER},
)
async def delete_job(job_id: uuid.UUID, current_user: CurrentUser, session: SessionDep) -> None:
    await service.delete_job(session, current_user, job_id)
