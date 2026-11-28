"""Database queries for jobs - no business decisions here."""

import uuid
from datetime import datetime

from sqlalchemy import ColumnElement, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Job, JobStatus


def status_filter(status: str, now: datetime) -> ColumnElement[bool]:
    """The SQL for a displayed status: "expired" is an open job past its date,
    and "open" excludes those."""
    if status == "expired":
        return and_(Job.status == JobStatus.OPEN, Job.expires_at <= now)
    if status == JobStatus.OPEN:
        return and_(
            Job.status == JobStatus.OPEN, or_(Job.expires_at.is_(None), Job.expires_at > now)
        )
    return Job.status == status


async def list_for_company(
    session: AsyncSession,
    company_id: uuid.UUID,
    *,
    status: str | None,
    now: datetime,
    limit: int,
    offset: int,
) -> tuple[list[Job], int]:
    """One page of the company's jobs, newest first, and the total that match."""
    where = [Job.company_id == company_id]
    if status is not None:
        where.append(status_filter(status, now))
    total = await session.scalar(select(func.count()).select_from(Job).where(*where))
    rows = await session.scalars(
        select(Job)
        .where(*where)
        .order_by(Job.created_at.desc(), Job.id)
        .limit(limit)
        .offset(offset)
    )
    return list(rows), total or 0


async def get(session: AsyncSession, company_id: uuid.UUID, job_id: uuid.UUID) -> Job | None:
    return await session.scalar(select(Job).where(Job.company_id == company_id, Job.id == job_id))


async def add(session: AsyncSession, job: Job) -> Job:
    session.add(job)
    await session.commit()
    await session.refresh(job)
    return job


async def save(session: AsyncSession, job: Job) -> Job:
    await session.commit()
    await session.refresh(job)
    return job


async def delete(session: AsyncSession, job: Job) -> None:
    await session.delete(job)
    await session.commit()
