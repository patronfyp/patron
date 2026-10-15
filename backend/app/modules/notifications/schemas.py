"""Request/response shapes for the notifications module."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from .models import NotificationType

DEFAULT_LIMIT = 20
MAX_LIMIT = 100  # STANDARDS.md §3.3 - a bigger limit is a 422, not a slow query


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: NotificationType
    title: str
    body: str | None
    link: str | None
    read_at: datetime | None
    created_at: datetime


class NotificationPage(BaseModel):
    """Returned by GET /notifications/me - the paginated list shape every list
    endpoint uses (STANDARDS.md §3.3)."""

    items: list[NotificationRead]
    total: int
    limit: int
    offset: int


class UnreadCount(BaseModel):
    """Returned by GET /notifications/me/unread-count - the number on the bell."""

    count: int


class PageParams(BaseModel):
    """Query parameters for the list."""

    limit: int = Field(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT)
    offset: int = Field(default=0, ge=0)
