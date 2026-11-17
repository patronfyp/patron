"""Jobs a company hires for (Module 4). Recruiter onboarding creates drafts;
job posting (Sprint 5) opens them."""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class JobStatus(StrEnum):
    DRAFT = "draft"
    OPEN = "open"
    CLOSED = "closed"


class Job(Base):
    """One role a company is hiring for."""

    __tablename__ = "jobs"
    # "This company's open jobs" is the query every job page will run.
    __table_args__ = (Index("ix_jobs_company_id_status", "company_id", "status"),)

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
    # Values come from JobStatus.
    status: Mapped[str] = mapped_column(
        String(20), default=JobStatus.DRAFT, server_default=JobStatus.DRAFT.value
    )

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<Job id={self.id} title={self.title!r} status={self.status!r}>"
