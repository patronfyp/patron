"""Request/response shapes for jobs. Clients never set the company, status,
dates or author - status changes go through publish / close / reopen."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

from app.modules.profiles.models import WorkMode

from .models import JobLevel, JobType

# Monthly PKR - catches a typo with three extra zeros, as on profiles.
_MAX_SALARY = 10_000_000
_MAX_OPENINGS = 50
_MAX_DESCRIPTION = 10_000
_MAX_REQUIREMENTS = 5_000
_MAX_SKILLS = 20
# A posting says what the job is; a one-liner isn't one.
MIN_DESCRIPTION = 50

# Publish: open for this many days, 7 to 90 (default 30).
DEFAULT_OPEN_DAYS = 30
MIN_OPEN_DAYS = 7
MAX_OPEN_DAYS = 90

# What the company sees; "expired" is an open job past its date.
DisplayStatus = Literal["draft", "open", "closed", "expired"]


def _clean_skills(skills: list[str] | None) -> list[str] | None:
    """Trimmed, no empties, no case-insensitive repeats, order kept."""
    if skills is None:
        return None
    seen: set[str] = set()
    result = []
    for skill in skills:
        cleaned = skill.strip()
        if cleaned and cleaned.lower() not in seen:
            if len(cleaned) > 50:
                raise ValueError("A skill can be at most 50 characters")
            seen.add(cleaned.lower())
            result.append(cleaned)
    if len(result) > _MAX_SKILLS:
        raise ValueError(f"At most {_MAX_SKILLS} skills")
    return result


def _strip_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


class _JobFields(BaseModel):
    """The posting fields a draft may leave out (all optional)."""

    model_config = ConfigDict(extra="forbid")

    description: str | None = Field(default=None, max_length=_MAX_DESCRIPTION)
    requirements: str | None = Field(default=None, max_length=_MAX_REQUIREMENTS)
    job_type: JobType | None = None
    level: JobLevel | None = None
    skills: list[str] | None = Field(default=None, max_length=_MAX_SKILLS * 2)

    @field_validator("description", "requirements")
    @classmethod
    def _text(cls, value: str | None) -> str | None:
        return _strip_text(value)

    @field_validator("skills")
    @classmethod
    def _skills(cls, value: list[str] | None) -> list[str] | None:
        return _clean_skills(value)


class JobCreate(_JobFields):
    """POST /companies/me/jobs - a draft role (Hiring step, Figma 67:1170)."""

    title: str = Field(min_length=1, max_length=150)
    location: str = Field(min_length=1, max_length=100)
    work_mode: WorkMode
    salary_min: int | None = Field(default=None, ge=0, le=_MAX_SALARY)
    salary_max: int | None = Field(default=None, ge=0, le=_MAX_SALARY)
    openings: int = Field(default=1, ge=1, le=_MAX_OPENINGS)

    @field_validator("title", "location")
    @classmethod
    def _strip(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field is required")
        return cleaned

    @model_validator(mode="after")
    def _salary_range(self) -> "JobCreate":
        if (
            self.salary_min is not None
            and self.salary_max is not None
            and self.salary_min > self.salary_max
        ):
            raise ValueError("The minimum salary can't be more than the maximum.")
        return self


class JobUpdate(_JobFields):
    """PATCH /companies/me/jobs/{id}. Only fields sent change; null clears an
    optional field. While a job is open, what publishing needs can't be cleared."""

    title: str | None = Field(default=None, min_length=1, max_length=150)
    location: str | None = Field(default=None, min_length=1, max_length=100)
    work_mode: WorkMode | None = None
    salary_min: int | None = Field(default=None, ge=0, le=_MAX_SALARY)
    salary_max: int | None = Field(default=None, ge=0, le=_MAX_SALARY)
    openings: int | None = Field(default=None, ge=1, le=_MAX_OPENINGS)


class JobPublish(BaseModel):
    """POST /companies/me/jobs/{id}/publish (and /reopen)."""

    model_config = ConfigDict(extra="forbid")

    open_days: int = Field(default=DEFAULT_OPEN_DAYS, ge=MIN_OPEN_DAYS, le=MAX_OPEN_DAYS)


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    location: str
    work_mode: WorkMode
    salary_min: int | None
    salary_max: int | None
    openings: int
    description: str | None
    requirements: str | None
    job_type: JobType | None
    level: JobLevel | None
    skills: list[str]
    published_at: datetime | None
    expires_at: datetime | None
    closed_at: datetime | None
    created_at: datetime
    # The stored status; the `status` the API returns also says "expired".
    status_stored: str = Field(validation_alias="status", exclude=True)
    is_expired: bool = Field(exclude=True)

    @computed_field
    @property
    def status(self) -> DisplayStatus:
        return "expired" if self.is_expired else self.status_stored


class JobPage(BaseModel):
    """One page of the company's jobs, and how many match in all."""

    items: list[JobRead]
    total: int
