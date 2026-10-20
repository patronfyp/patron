"""Request/response shapes for the profiles module.

Separate Update/Read schemas, always - STANDARDS.md §3.4. A client can set only
the fields listed in ProfileUpdate; `id`, `user_id`, file keys and timestamps
are never accepted from the outside.
"""

import re
import uuid
from datetime import UTC, date, datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.core.config import get_settings

from .models import (
    MONTHLY_REFERRAL_LIMITS,
    ONBOARDING_STEP_COUNT,
    DesiredRole,
    PrimaryRole,
    ReferralTeam,
    WorkMode,
)

# Earliest graduation year we accept. Anything before this is a typo, not an
# alumnus - the platform is for people who are working or about to.
_MIN_GRADUATION_YEAR = 1950
# A student can be several years from graduating, but not decades.
_MAX_YEARS_AHEAD = 8

_MAX_SKILLS = 30
_MAX_LOCATIONS = 10
# Monthly PKR. High enough for any real offer, low enough to catch a typo
# with three extra zeros.
_MAX_SALARY = 10_000_000

# "+92 300 1234567", "0300-1234567" -> digits only, then a + and 10-15 digits.
_PHONE_PATTERN = re.compile(r"^\+\d{10,15}$")
# Public profile URLs only: linkedin.com/in/<slug>, with or without the
# scheme and www.
_LINKEDIN_PATTERN = re.compile(
    r"^(?:https?://)?(?:[a-z]{2,3}\.)?linkedin\.com/in/([A-Za-z0-9\-_%]{3,100})/?$",
    re.IGNORECASE,
)


def photo_url(photo_key: str | None) -> str | None:
    """The API path a photo is served from, or None. Relative to the API
    origin, so it stays right whatever host the API runs on."""
    if photo_key is None:
        return None
    filename = photo_key.split("/", 1)[1]
    return f"{get_settings().api_v1_prefix}/profile/photos/{filename}"


class CvRead(BaseModel):
    """The uploaded CV's details - never its contents or storage key."""

    filename: str
    size_bytes: int
    uploaded_at: datetime


class ProfileRead(BaseModel):
    """Returned by GET and PATCH /profile/me and the upload endpoints."""

    model_config = ConfigDict(from_attributes=True)

    headline: str | None
    city: str | None
    phone: str | None
    linkedin_url: str | None
    bio: str | None
    # Read from the model, turned into `photo_url` below, never returned.
    photo_key: str | None = Field(exclude=True)

    university: str | None
    degree: str | None
    graduation_year: int | None
    employer_name: str | None

    cv_filename: str | None = Field(exclude=True)
    cv_size_bytes: int | None = Field(exclude=True)
    cv_uploaded_at: datetime | None = Field(exclude=True)

    skills: list[str]
    primary_role: PrimaryRole | None

    desired_roles: list[DesiredRole]
    work_mode: WorkMode | None
    preferred_locations: list[str]
    salary_min: int | None
    salary_max: int | None
    available_from: date | None
    open_to_referrers: bool

    job_title: str | None
    team: str | None
    referral_teams: list[ReferralTeam]
    monthly_referral_limit: int | None
    accept_alumni_requests: bool
    accept_any_verified_requests: bool

    onboarding_step: int
    onboarding_completed_at: datetime | None = Field(exclude=True)

    @computed_field
    @property
    def photo_url(self) -> str | None:
        return photo_url(self.photo_key)

    @computed_field
    @property
    def cv(self) -> CvRead | None:
        if self.cv_filename is None or self.cv_size_bytes is None or self.cv_uploaded_at is None:
            return None
        return CvRead(
            filename=self.cv_filename,
            size_bytes=self.cv_size_bytes,
            uploaded_at=self.cv_uploaded_at,
        )

    @computed_field
    @property
    def onboarding_completed(self) -> bool:
        return self.onboarding_completed_at is not None


class PublicProfileRead(BaseModel):
    """Returned by GET /profile/{user_id} - what any signed-in user may see.

    Deliberately leaves out everything private: phone, CV, salary, the rest of
    the job preferences and onboarding progress. Built field by field in the
    service, never straight from the model, so a new private column can't leak
    by default.
    """

    user_id: uuid.UUID
    full_name: str
    roles: list[str]
    # Our uploaded photo (an API path, like ProfileRead.photo_url), else None.
    photo_url: str | None
    # The LinkedIn picture, for users who signed up with LinkedIn and have no
    # photo of their own yet. A full URL.
    avatar_url: str | None
    headline: str | None
    city: str | None
    bio: str | None
    linkedin_url: str | None
    university: str | None
    degree: str | None
    graduation_year: int | None
    employer_name: str | None
    skills: list[str]
    primary_role: PrimaryRole | None
    # The Verified Alumni / Verified Employee badges.
    university_verified: bool
    employer_verified: bool


def _dedupe(values: list[str]) -> list[str]:
    """Trim each value, drop empties and case-insensitive repeats, keep order."""
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        cleaned = value.strip()
        if cleaned and cleaned.lower() not in seen:
            seen.add(cleaned.lower())
            result.append(cleaned)
    return result


class ProfileUpdate(BaseModel):
    """What a client sends to PATCH /profile/me.

    Every field is optional: only the ones sent are changed. Sending a text
    field as null clears it; send `[]` to clear a list. `onboarding_step`
    cannot be cleared, only moved.
    """

    # A typo like `universty` should fail loudly, not be silently ignored.
    model_config = ConfigDict(extra="forbid")

    headline: str | None = Field(default=None, max_length=120)
    city: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=30)
    linkedin_url: str | None = Field(default=None, max_length=255)
    bio: str | None = Field(default=None, max_length=280)

    university: str | None = Field(default=None, max_length=200)
    degree: str | None = Field(default=None, max_length=150)
    graduation_year: int | None = None
    employer_name: str | None = Field(default=None, max_length=200)

    skills: list[str] = Field(default_factory=list, max_length=_MAX_SKILLS)
    primary_role: PrimaryRole | None = None

    desired_roles: list[DesiredRole] = Field(default_factory=list)
    work_mode: WorkMode | None = None
    preferred_locations: list[str] = Field(default_factory=list, max_length=_MAX_LOCATIONS)
    salary_min: int | None = Field(default=None, ge=0, le=_MAX_SALARY)
    salary_max: int | None = Field(default=None, ge=0, le=_MAX_SALARY)
    available_from: date | None = None
    open_to_referrers: bool = True

    job_title: str | None = Field(default=None, max_length=150)
    team: str | None = Field(default=None, max_length=100)
    referral_teams: list[ReferralTeam] = Field(default_factory=list)
    monthly_referral_limit: int | None = None
    accept_alumni_requests: bool = True
    accept_any_verified_requests: bool = False

    # The upper bound here is the longest wizard; the service checks it
    # against this user's own wizard.
    onboarding_step: int = Field(default=1, ge=1, le=ONBOARDING_STEP_COUNT)

    @field_validator(
        "headline", "city", "bio", "university", "degree", "employer_name", "job_title", "team"
    )
    @classmethod
    def _strip_text(cls, value: str | None) -> str | None:
        """Trim whitespace; a field that is only spaces counts as cleared."""
        if value is None:
            return None
        return value.strip() or None

    @field_validator("phone")
    @classmethod
    def _normalise_phone(cls, value: str | None) -> str | None:
        """Keep digits and a leading +; a local 03xx number becomes +923xx."""
        if value is None or not value.strip():
            return None
        digits = re.sub(r"\D", "", value)
        if value.strip().startswith("+"):
            phone = f"+{digits}"
        elif digits.startswith("0"):
            phone = f"+92{digits[1:]}"
        else:
            phone = f"+{digits}"
        if not _PHONE_PATTERN.fullmatch(phone):
            raise ValueError("Enter a phone number with its country code, e.g. +92 300 1234567")
        return phone

    @field_validator("linkedin_url")
    @classmethod
    def _normalise_linkedin(cls, value: str | None) -> str | None:
        """Accept any common way of writing a profile URL; store one form."""
        if value is None or not value.strip():
            return None
        match = _LINKEDIN_PATTERN.fullmatch(value.strip())
        if match is None:
            raise ValueError("Enter your LinkedIn profile URL, e.g. linkedin.com/in/your-name")
        return f"https://www.linkedin.com/in/{match.group(1)}"

    @field_validator("graduation_year")
    @classmethod
    def _plausible_year(cls, value: int | None) -> int | None:
        if value is None:
            return None
        latest = datetime.now(UTC).year + _MAX_YEARS_AHEAD
        if not _MIN_GRADUATION_YEAR <= value <= latest:
            raise ValueError(f"graduation_year must be between {_MIN_GRADUATION_YEAR} and {latest}")
        return value

    @field_validator("skills")
    @classmethod
    def _clean_skills(cls, values: list[str]) -> list[str]:
        skills = _dedupe(values)
        if any(len(skill) > 50 for skill in skills):
            raise ValueError("A skill can be at most 50 characters")
        return skills

    @field_validator("preferred_locations")
    @classmethod
    def _clean_locations(cls, values: list[str]) -> list[str]:
        locations = _dedupe(values)
        if any(len(location) > 100 for location in locations):
            raise ValueError("A location can be at most 100 characters")
        return locations

    @field_validator("desired_roles")
    @classmethod
    def _unique_roles(cls, values: list[DesiredRole]) -> list[DesiredRole]:
        return list(dict.fromkeys(values))

    @field_validator("referral_teams")
    @classmethod
    def _unique_teams(cls, values: list[ReferralTeam]) -> list[ReferralTeam]:
        return list(dict.fromkeys(values))

    @field_validator("monthly_referral_limit")
    @classmethod
    def _known_limit(cls, value: int | None) -> int | None:
        """Only the design's choices; null means "No limit"."""
        if value is not None and value not in MONTHLY_REFERRAL_LIMITS:
            choices = ", ".join(str(limit) for limit in MONTHLY_REFERRAL_LIMITS)
            raise ValueError(f"monthly_referral_limit must be one of {choices}, or null")
        return value

    @field_validator("available_from")
    @classmethod
    def _first_of_month(cls, value: date | None) -> date | None:
        """The design asks for a month, not a day."""
        return value.replace(day=1) if value is not None else None
