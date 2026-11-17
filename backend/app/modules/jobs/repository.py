"""Database queries for jobs - no business decisions here."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Job


async def list_for_company(session: AsyncSession, company_id: uuid.UUID, limit: int) -> list[Job]:
    """Oldest first, so roles keep the order they were added in."""
    stmt = (
        select(Job)
        .where(Job.company_id == company_id)
        .order_by(Job.created_at, Job.id)
        .limit(limit)
    )
    return list(await session.scalars(stmt))


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
