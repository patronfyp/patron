"""Business rules for the notifications module.

`notify()` is the one way any other module creates a notification.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.auth.models import User

from . import repository
from .models import Notification, NotificationType
from .schemas import NotificationPage, NotificationRead, PageParams


async def notify(
    session: AsyncSession,
    user_id: uuid.UUID,
    type: NotificationType,
    title: str,
    *,
    body: str | None = None,
    link: str | None = None,
) -> Notification:
    """Create a notification for a user.

    `link` must be an app path ("/onboarding"); anything else is dropped
    rather than stored, so a notification can never point off-site.
    """
    safe_link = link if link and link.startswith("/") and not link.startswith("//") else None
    return await repository.create(
        session, user_id=user_id, type=type.value, title=title, body=body, link=safe_link
    )


async def list_notifications(
    session: AsyncSession, user: User, params: PageParams
) -> NotificationPage:
    rows = await repository.list_for_user(
        session, user.id, limit=params.limit, offset=params.offset
    )
    total = await repository.count_for_user(session, user.id)
    return NotificationPage(
        items=[NotificationRead.model_validate(row) for row in rows],
        total=total,
        limit=params.limit,
        offset=params.offset,
    )


async def unread_count(session: AsyncSession, user: User) -> int:
    return await repository.count_unread(session, user.id)


async def mark_read(session: AsyncSession, user: User, notification_id: uuid.UUID) -> Notification:
    """Mark one notification read. Someone else's notification is a 404, the
    same as one that doesn't exist - a 403 would confirm it exists.
    Marking an already-read one again keeps its first read time."""
    row = await repository.get_for_user(session, notification_id, user.id)
    if row is None:
        raise NotFoundError("Notification not found")
    if row.read_at is None:
        row.read_at = datetime.now(UTC)
        row = await repository.save(session, row)
    return row


async def mark_all_read(session: AsyncSession, user: User) -> None:
    await repository.mark_all_read(session, user.id, datetime.now(UTC))
