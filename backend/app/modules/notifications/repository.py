"""Database queries for notifications - no business decisions here."""

import uuid
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Notification


async def create(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str | None,
    link: str | None,
) -> Notification:
    row = Notification(user_id=user_id, type=type, title=title, body=body, link=link)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def list_for_user(
    session: AsyncSession, user_id: uuid.UUID, *, limit: int, offset: int
) -> list[Notification]:
    """Newest first. `id` breaks ties so paging never repeats or skips a row."""
    stmt = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return list((await session.scalars(stmt)).all())


async def count_for_user(session: AsyncSession, user_id: uuid.UUID) -> int:
    stmt = select(func.count()).select_from(Notification).where(Notification.user_id == user_id)
    return await session.scalar(stmt) or 0


async def count_unread(session: AsyncSession, user_id: uuid.UUID) -> int:
    stmt = (
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id, Notification.read_at.is_(None))
    )
    return await session.scalar(stmt) or 0


async def get_for_user(
    session: AsyncSession, notification_id: uuid.UUID, user_id: uuid.UUID
) -> Notification | None:
    """One notification, only if it belongs to this user."""
    stmt = select(Notification).where(
        Notification.id == notification_id, Notification.user_id == user_id
    )
    return await session.scalar(stmt)


async def save(session: AsyncSession, row: Notification) -> Notification:
    await session.commit()
    await session.refresh(row)
    return row


async def mark_all_read(session: AsyncSession, user_id: uuid.UUID, now: datetime) -> None:
    """Mark every unread notification read in one statement. Already-read ones
    keep their original `read_at`."""
    stmt = (
        update(Notification)
        .where(Notification.user_id == user_id, Notification.read_at.is_(None))
        .values(read_at=now)
    )
    await session.execute(stmt)
    await session.commit()
