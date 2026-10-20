"""HTTP layer for the notifications module. URL, validation, response shape - no
business logic and no queries. STANDARDS.md §2.3."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.database import get_session

from . import service
from .schemas import NotificationPage, NotificationRead, PageParams, UnreadCount

router = APIRouter(prefix="/notifications", tags=["notifications"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]

_UNAUTHORIZED = {401: {"description": "Missing, invalid or expired access token"}}


@router.get(
    "/me",
    response_model=NotificationPage,
    summary="List my notifications",
    responses={**_UNAUTHORIZED, 422: {"description": "limit above 100 or a negative offset"}},
)
async def list_my_notifications(
    current_user: CurrentUser,
    session: SessionDep,
    params: Annotated[PageParams, Query()],
) -> NotificationPage:
    """Newest first, `limit` (default 20, max 100) at a time from `offset`.
    `total` is every notification the user has, read or not."""
    return await service.list_notifications(session, current_user, params)


@router.get(
    "/me/unread-count",
    response_model=UnreadCount,
    summary="How many of my notifications are unread",
    responses=_UNAUTHORIZED,
)
async def get_unread_count(current_user: CurrentUser, session: SessionDep) -> UnreadCount:
    """The number on the bell."""
    return UnreadCount(count=await service.unread_count(session, current_user))


@router.post(
    "/me/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark all my notifications read",
    responses=_UNAUTHORIZED,
)
async def mark_all_read(current_user: CurrentUser, session: SessionDep) -> None:
    await service.mark_all_read(session, current_user)


@router.post(
    "/{notification_id}/read",
    response_model=NotificationRead,
    summary="Mark one notification read",
    responses={**_UNAUTHORIZED, 404: {"description": "No such notification of yours"}},
)
async def mark_read(
    notification_id: uuid.UUID, current_user: CurrentUser, session: SessionDep
) -> NotificationRead:
    """Someone else's notification is a 404, exactly like one that doesn't exist."""
    row = await service.mark_read(session, current_user, notification_id)
    return NotificationRead.model_validate(row)
