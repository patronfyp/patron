"""Job endpoints for the signed-in user's company (ADR 0025)."""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Body, Query, status

from app.api.deps import CurrentUser, SessionDep

from . import service
from .schemas import JobCreate, JobPage, JobPublish, JobRead, JobUpdate

router = APIRouter(prefix="/companies/me/jobs", tags=["jobs"])

_UNAUTHORIZED = {401: {"description": "Missing, invalid or expired access token"}}
_NO_COMPANY = {404: {"description": "You don't belong to a company yet"}}
_NOT_WRITER = {403: {"description": "Interviewers can't change jobs"}}
_NO_JOB = {404: {"description": "No company, or no such job at it"}}

PublishBody = Annotated[JobPublish, Body(default_factory=JobPublish)]


@router.get(
    "",
    response_model=JobPage,
    summary="List my company's jobs",
    responses={**_UNAUTHORIZED, **_NO_COMPANY, 422: {"description": "Bad status, limit or offset"}},
)
async def list_jobs(
    current_user: CurrentUser,
    session: SessionDep,
    job_status: Annotated[
        Literal["draft", "open", "closed", "expired"] | None, Query(alias="status")
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> JobPage:
    """Newest first, `limit` at a time, optionally one status. Interviewers can read."""
    return await service.list_jobs(
        session, current_user, status=job_status, limit=limit, offset=offset
    )


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


@router.get(
    "/{job_id}",
    response_model=JobRead,
    summary="Get one of my company's jobs",
    responses={**_UNAUTHORIZED, **_NO_JOB},
)
async def get_job(job_id: uuid.UUID, current_user: CurrentUser, session: SessionDep) -> JobRead:
    return await service.get_job(session, current_user, job_id)


@router.patch(
    "/{job_id}",
    response_model=JobRead,
    summary="Update a job",
    responses={
        **_UNAUTHORIZED,
        **_NO_JOB,
        **_NOT_WRITER,
        422: {"description": "Invalid fields, or an open job losing a required field"},
    },
)
async def update_job(
    job_id: uuid.UUID, payload: JobUpdate, current_user: CurrentUser, session: SessionDep
) -> JobRead:
    """Change only the fields sent. Send null to clear an optional field."""
    return await service.update_job(session, current_user, job_id, payload)


@router.post(
    "/{job_id}/publish",
    response_model=JobRead,
    summary="Publish a draft",
    responses={
        **_UNAUTHORIZED,
        **_NO_JOB,
        **_NOT_WRITER,
        409: {"description": "Not a draft"},
        422: {"description": "Missing a description, job type or level, or bad open_days"},
    },
)
async def publish_job(
    job_id: uuid.UUID, current_user: CurrentUser, session: SessionDep, payload: PublishBody
) -> JobRead:
    """Open the job for `open_days` (7-90, default 30). After that it shows as expired."""
    return await service.publish_job(session, current_user, job_id, payload)


@router.post(
    "/{job_id}/close",
    response_model=JobRead,
    summary="Close an open job",
    responses={**_UNAUTHORIZED, **_NO_JOB, **_NOT_WRITER, 409: {"description": "Not open"}},
)
async def close_job(job_id: uuid.UUID, current_user: CurrentUser, session: SessionDep) -> JobRead:
    return await service.close_job(session, current_user, job_id)


@router.post(
    "/{job_id}/reopen",
    response_model=JobRead,
    summary="Reopen a closed or expired job",
    responses={
        **_UNAUTHORIZED,
        **_NO_JOB,
        **_NOT_WRITER,
        409: {"description": "A draft, or already open"},
        422: {"description": "Missing a required field, or bad open_days"},
    },
)
async def reopen_job(
    job_id: uuid.UUID, current_user: CurrentUser, session: SessionDep, payload: PublishBody
) -> JobRead:
    """Open it again for `open_days`, with a fresh expiry."""
    return await service.reopen_job(session, current_user, job_id, payload)


@router.delete(
    "/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a draft",
    responses={
        **_UNAUTHORIZED,
        **_NO_JOB,
        **_NOT_WRITER,
        409: {"description": "Published jobs are closed, not deleted"},
    },
)
async def delete_job(job_id: uuid.UUID, current_user: CurrentUser, session: SessionDep) -> None:
    await service.delete_job(session, current_user, job_id)
