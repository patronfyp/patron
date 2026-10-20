"""One message for one user (Module 11). Other modules create them only
through `notifications.service.notify()`."""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class NotificationType(StrEnum):
    """What happened. Stored as a plain string, like `UserRole` - adding a
    type needs no migration."""

    EMAIL_VERIFIED = "email_verified"
    DOCUMENT_UPLOADED = "document_uploaded"


class Notification(Base):
    __tablename__ = "notifications"
    # The bell's two queries - "my newest" and "my unread" - both start from
    # the user, so the index leads with user_id.
    __table_args__ = (Index("ix_notifications_user_id_created_at", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    # Values come from NotificationType.
    type: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str | None] = mapped_column(String(500), default=None)
    # Where clicking it goes, as an app path like "/onboarding". Never a full
    # URL, so a notification can't send anyone off-site.
    link: Mapped[str | None] = mapped_column(String(255), default=None)

    # Null means unread.
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<Notification id={self.id} user_id={self.user_id} type={self.type!r}>"
