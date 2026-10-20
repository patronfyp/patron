"""Verification models: proof that a user is who they say they are.

`EmailVerification` is proof that a user controls an email address - their
sign-up address (which sets `User.is_email_verified`), a university email or a
work email (Module 1.9). The last two earn the Verified Alumni and Verified
Employee badges. Each attempt to prove one is a row.

`VerificationDocument` is the other route to the same badges: an uploaded
transcript, degree or employment letter that a person reviews (Modules 1.10,
1.11). Until admin review exists (Module 13) every document stays pending.
"""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class VerificationKind(StrEnum):
    """What the email or document is being verified for."""

    ACCOUNT = "account"  # the address the user signed up with
    UNIVERSITY = "university"
    EMPLOYER = "employer"


class DocumentStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class EmailVerification(Base):
    """One code sent to one address.

    A new send creates a new row rather than reusing the old one, so the
    history of attempts is kept and the resend rate limit can be read straight
    off `created_at`.
    """

    __tablename__ = "email_verifications"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    # The address being proven, always lowercase.
    email: Mapped[str] = mapped_column(String(255))
    # Values come from VerificationKind.
    kind: Mapped[str] = mapped_column(String(20))

    # A hash of the 6-digit code, never the code itself - a leaked table must
    # not hand out working codes.
    code_hash: Mapped[str] = mapped_column(String(128))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    # Wrong guesses so far. Six digits is only a million possibilities, so the
    # service stops accepting this row after a handful of misses.
    attempts: Mapped[int] = mapped_column(default=0, server_default=text("0"))

    # Set when the correct code is entered. Also what makes a code single-use.
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<EmailVerification id={self.id} user_id={self.user_id} kind={self.kind!r}>"


class VerificationDocument(Base):
    """One uploaded document waiting for (or past) review."""

    __tablename__ = "verification_documents"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    # Values come from VerificationKind (university or employer, never account).
    kind: Mapped[str] = mapped_column(String(20))
    # Storage key (app/core/storage.py), e.g. "documents/<uuid>.pdf".
    file_key: Mapped[str] = mapped_column(String(100))
    # The name the user's file had, shown back to them.
    filename: Mapped[str] = mapped_column(String(255))
    size_bytes: Mapped[int]

    # Values come from DocumentStatus.
    status: Mapped[str] = mapped_column(
        String(20), default=DocumentStatus.PENDING, server_default=DocumentStatus.PENDING.value
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<VerificationDocument id={self.id} kind={self.kind!r} status={self.status!r}>"
