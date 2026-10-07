"""Profile model: what we know about a person beyond their login.

Kept apart from `User` on purpose. `User` is the account and is read on every
authenticated request; the profile is filled in gradually through onboarding
(Modules 1.4, 1.5) and will keep growing, so it lives in its own table and
changes to it never touch the auth tables.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from db import Base

# Onboarding has seven steps (Account, Profile, University, Employer, Skills,
# CV, Preferences). The wizard itself lives in the frontend; the backend only
# remembers how far the user got.
ONBOARDING_STEP_COUNT = 7


class Profile(Base):
    """One row per user, created the first time it is read."""

    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(primary_key=True)

    # unique=True makes this one-to-one: a user cannot have two profiles.
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )

    # Institutional fields - Module 1.4. All optional: a candidate may skip
    # the employer step, and nobody has them filled in at registration.
    university: Mapped[str | None] = mapped_column(String(200), default=None)
    degree: Mapped[str | None] = mapped_column(String(150), default=None)
    graduation_year: Mapped[int | None] = mapped_column(default=None)
    employer_name: Mapped[str | None] = mapped_column(String(200), default=None)

    # The step the user is currently on, 1..ONBOARDING_STEP_COUNT. Lets the
    # wizard resume where "Save & exit" left off - Module 1.5.
    onboarding_step: Mapped[int] = mapped_column(default=1, server_default=text("1"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<Profile id={self.id} user_id={self.user_id} step={self.onboarding_step}>"
