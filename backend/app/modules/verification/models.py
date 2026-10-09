"""Verification models: proof that a user controls an email address.

`User.is_email_verified` already covers the email they signed up with. This is
for the *other* addresses - a university email and a work email (Module 1.9) -
which are what earn the Verified Alumni and Verified Employee badges. Each
attempt to prove one is a row here.
"""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


class VerificationKind(StrEnum):
    """Which badge the email is being verified for."""

    UNIVERSITY = "university"
    EMPLOYER = "employer"


class EmailVerification(Base):
    """One code sent to one address.

    A new send creates a new row rather than reusing the old one, so the
    history of attempts is kept and the resend rate limit can be read straight
    off `created_at`.
    """

    __tablename__ = "email_verifications"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    # The address being proven, always lowercase. Not the user's login email.
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
