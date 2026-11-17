"""Request/response shapes for jobs. Clients never set the company, status or author."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.modules.profiles.models import WorkMode

from .models import JobStatus

# Monthly PKR - catches a typo with three extra zeros, as on profiles.
_MAX_SALARY = 10_000_000
_MAX_OPENINGS = 50


class JobCreate(BaseModel):
    """POST /companies/me/jobs - a draft role (Hiring step, Figma 67:1170)."""

    model_config = ConfigDict(extra="forbid")

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


class JobUpdate(BaseModel):
    """PATCH /companies/me/jobs/{id}. Only fields sent change; null clears a salary end."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=150)
    location: str | None = Field(default=None, min_length=1, max_length=100)
    work_mode: WorkMode | None = None
    salary_min: int | None = Field(default=None, ge=0, le=_MAX_SALARY)
    salary_max: int | None = Field(default=None, ge=0, le=_MAX_SALARY)
    openings: int | None = Field(default=None, ge=1, le=_MAX_OPENINGS)


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    location: str
    work_mode: WorkMode
    salary_min: int | None
    salary_max: int | None
    openings: int
    status: JobStatus
    created_at: datetime
