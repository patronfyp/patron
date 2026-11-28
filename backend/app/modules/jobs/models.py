"""Jobs a company hires for (Module 4). Recruiter onboarding creates drafts;
job posting opens them (ADR 0025)."""

import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import ARRAY, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class JobStatus(StrEnum):
    """What is stored. "Expired" is not stored: an open job past `expires_at`."""

    DRAFT = "draft"
    OPEN = "open"
    CLOSED = "closed"


class JobType(StrEnum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    INTERNSHIP = "internship"


class JobLevel(StrEnum):
    INTERN = "intern"
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"


class Job(Base):
    """One role a company is hiring for."""

    __tablename__ = "jobs"
    __table_args__ = (
        # "This company's jobs by status" - the company's own list.
        Index("ix_jobs_company_id_status", "company_id", "status"),
        # "Open jobs, newest first" - the public listing (#130).
        Index("ix_jobs_status_published_at", "status", "published_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"))

    title: Mapped[str] = mapped_column(String(150))
    location: Mapped[str] = mapped_column(String(100))
    # Values come from profiles.models.WorkMode.
    work_mode: Mapped[str] = mapped_column(String(20))
    # Monthly PKR, like a candidate's expected salary.
    salary_min: Mapped[int | None] = mapped_column(default=None)
    salary_max: Mapped[int | None] = mapped_column(default=None)
    openings: Mapped[int] = mapped_column(default=1, server_default=text("1"))

    # The full posting. Optional on a draft, required to publish.
    description: Mapped[str | None] = mapped_column(Text, default=None)
    requirements: Mapped[str | None] = mapped_column(Text, default=None)
    # Values come from JobType and JobLevel.
    job_type: Mapped[str | None] = mapped_column(String(20), default=None)
    level: Mapped[str | None] = mapped_column(String(20), default=None)
    skills: Mapped[list[str]] = mapped_column(
        ARRAY(String(50)), default=list, server_default=text("'{}'")
    )

    # Values come from JobStatus.
    status: Mapped[str] = mapped_column(
        String(20), default=JobStatus.DRAFT, server_default=JobStatus.DRAFT.value
    )
    # Set on publish (and on reopen); null while a draft.
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True, default=None
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @property
    def is_expired(self) -> bool:
        """Open, but past its expiry - treated as closed everywhere."""
        return (
            self.status == JobStatus.OPEN
            and self.expires_at is not None
            and self.expires_at <= datetime.now(UTC)
        )

    def __repr__(self) -> str:
        return f"<Job id={self.id} title={self.title!r} status={self.status!r}>"
