"""Profile model: what we know about a person beyond their login.

Kept apart from `User` on purpose. `User` is the account and is read on every
authenticated request; the profile is filled in gradually through onboarding
(Modules 1.4, 1.5) and will keep growing, so it lives in its own table and
changes to it never touch the auth tables.
"""

import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import ARRAY, Date, DateTime, ForeignKey, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from db import Base

# Onboarding has seven steps (Account, Profile, University, Employer, CV,
# Skills, Preferences). The wizard itself lives in the frontend; the backend
# only remembers how far the user got, and whether they finished.
ONBOARDING_STEP_COUNT = 7
# A user who is only a referrer gets a shorter wizard instead: Account,
# Employer, Referring. Anyone who is also a candidate keeps the seven steps.
REFERRER_ONBOARDING_STEP_COUNT = 3


def onboarding_step_count(roles: list[str]) -> int:
    """How many steps this user's wizard has."""
    return REFERRER_ONBOARDING_STEP_COUNT if roles == ["referrer"] else ONBOARDING_STEP_COUNT


class PrimaryRole(StrEnum):
    """The "Primary role" choice on the Skills step."""

    FULL_STACK = "full_stack"
    BACKEND = "backend"
    AI_ML = "ai_ml"
    FRONTEND = "frontend"


class DesiredRole(StrEnum):
    """The "Roles you want" chips on the Preferences step."""

    BACKEND_ENGINEER = "backend_engineer"
    FULL_STACK_ENGINEER = "full_stack_engineer"
    PLATFORM_DEVOPS = "platform_devops"
    DATA_ENGINEER = "data_engineer"
    FRONTEND_ENGINEER = "frontend_engineer"


class WorkMode(StrEnum):
    """The "Work mode" choice on the Preferences step."""

    ON_SITE = "on_site"
    HYBRID = "hybrid"
    REMOTE = "remote"


class ReferralTeam(StrEnum):
    """The "Teams you can refer for" chips on the referrer's Referring step."""

    BACKEND = "backend"
    FULL_STACK = "full_stack"
    PLATFORM = "platform"
    MOBILE = "mobile"
    DATA = "data"
    PRODUCT = "product"


# The "Requests per month" choices. "No limit" is stored as null.
MONTHLY_REFERRAL_LIMITS = (3, 5, 10)


class Profile(Base):
    """One row per user, created the first time it is read.

    Enum-like columns are plain strings with the classes above as the source
    of truth, like `UserRole` - adding an option needs no migration.
    """

    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    # unique=True makes this one-to-one: a user cannot have two profiles.
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )

    # About you - the Profile step. All optional until the user fills them in.
    headline: Mapped[str | None] = mapped_column(String(120), default=None)
    city: Mapped[str | None] = mapped_column(String(100), default=None)
    # Digits with a leading +, e.g. "+923001234567".
    phone: Mapped[str | None] = mapped_column(String(20), default=None)
    linkedin_url: Mapped[str | None] = mapped_column(String(255), default=None)
    bio: Mapped[str | None] = mapped_column(String(280), default=None)
    # Storage key (app/core/storage.py) of the uploaded photo, e.g.
    # "photos/<uuid>.jpg". Never a URL - ProfileRead builds that.
    photo_key: Mapped[str | None] = mapped_column(String(100), default=None)

    # Institutional fields - Module 1.4. A candidate may skip the employer step.
    university: Mapped[str | None] = mapped_column(String(200), default=None)
    degree: Mapped[str | None] = mapped_column(String(150), default=None)
    graduation_year: Mapped[int | None] = mapped_column(default=None)
    employer_name: Mapped[str | None] = mapped_column(String(200), default=None)

    # The CV step. Only the owner and, later, people they send a referral
    # request to may read the file.
    cv_key: Mapped[str | None] = mapped_column(String(100), default=None)
    cv_filename: Mapped[str | None] = mapped_column(String(255), default=None)
    cv_size_bytes: Mapped[int | None] = mapped_column(default=None)
    cv_uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    # The Skills step. Typed by the user for now; AI suggestions from the CV
    # come later (Module 9).
    skills: Mapped[list[str]] = mapped_column(
        ARRAY(String(50)), default=list, server_default=text("'{}'")
    )
    # Values come from PrimaryRole.
    primary_role: Mapped[str | None] = mapped_column(String(20), default=None)

    # The Preferences step.
    # Values come from DesiredRole.
    desired_roles: Mapped[list[str]] = mapped_column(
        ARRAY(String(30)), default=list, server_default=text("'{}'")
    )
    # Values come from WorkMode.
    work_mode: Mapped[str | None] = mapped_column(String(20), default=None)
    preferred_locations: Mapped[list[str]] = mapped_column(
        ARRAY(String(100)), default=list, server_default=text("'{}'")
    )
    # Expected monthly salary in PKR.
    salary_min: Mapped[int | None] = mapped_column(default=None)
    salary_max: Mapped[int | None] = mapped_column(default=None)
    # Stored as the first day of the month the user picked.
    available_from: Mapped[date | None] = mapped_column(Date, default=None)
    # "Let verified referrers find me". On by default, as in the design.
    open_to_referrers: Mapped[bool] = mapped_column(default=True, server_default=text("true"))

    # The referrer's Employer step - where they work is `employer_name` above.
    job_title: Mapped[str | None] = mapped_column(String(150), default=None)
    team: Mapped[str | None] = mapped_column(String(100), default=None)

    # The referrer's Referring step. Values come from ReferralTeam.
    referral_teams: Mapped[list[str]] = mapped_column(
        ARRAY(String(20)), default=list, server_default=text("'{}'")
    )
    # One of MONTHLY_REFERRAL_LIMITS, or null for "No limit". 5 is the
    # design's default choice.
    monthly_referral_limit: Mapped[int | None] = mapped_column(default=5, server_default=text("5"))
    # Both toggles default to what the design shows: alumni on, anyone off.
    accept_alumni_requests: Mapped[bool] = mapped_column(default=True, server_default=text("true"))
    accept_any_verified_requests: Mapped[bool] = mapped_column(
        default=False, server_default=text("false")
    )

    # The step the user is currently on, 1..onboarding_step_count(). Lets the
    # wizard resume where "Save & exit" left off - Module 1.5.
    onboarding_step: Mapped[int] = mapped_column(default=1, server_default=text("1"))
    # Set when the user presses "Finish setup". Being on the last step is not
    # the same as having finished it.
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<Profile id={self.id} user_id={self.user_id} step={self.onboarding_step}>"
