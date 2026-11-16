"""Companies and their members (Module 4). Verified by email domain - ADR 0020."""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CompanySize(StrEnum):
    """The "Company size" choices on the Company step (Figma 67:899)."""

    SMALL = "1-50"
    MEDIUM = "51-200"
    LARGE = "201-1000"
    ENTERPRISE = "1000+"


class Industry(StrEnum):
    """The "Industry" choices on the Company step."""

    SOFTWARE = "software"
    FINTECH = "fintech"
    ECOMMERCE = "ecommerce"
    TELECOM = "telecom"
    CONSULTING = "consulting"
    EDUCATION = "education"
    HEALTHCARE = "healthcare"
    MEDIA = "media"
    OTHER = "other"


class MemberRole(StrEnum):
    """What a member does at their company. The first recruiter is the owner."""

    OWNER = "owner"
    RECRUITER = "recruiter"
    HIRING_MANAGER = "hiring_manager"
    INTERVIEWER = "interviewer"


class Company(Base):
    """A company hiring through PATRON. Every row is verified by construction."""

    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    name: Mapped[str] = mapped_column(String(200))
    # Lowercase, no scheme or www - one domain is one company.
    domain: Mapped[str] = mapped_column(String(253), unique=True, index=True)
    # Values come from CompanySize and Industry.
    size: Mapped[str] = mapped_column(String(20))
    industry: Mapped[str] = mapped_column(String(30))
    headquarters: Mapped[str] = mapped_column(String(100))
    # Storage key, e.g. "logos/<uuid>.png" - never a URL; CompanyRead builds that.
    logo_key: Mapped[str | None] = mapped_column(String(100), default=None)
    # The Team step's "Let <company> employees join as referrers" (Figma 67:1040).
    employees_can_refer: Mapped[bool] = mapped_column(default=True, server_default=text("true"))

    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), default=None
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<Company id={self.id} domain={self.domain!r}>"


class CompanyMember(Base):
    """One user at one company, with their role."""

    __tablename__ = "company_members"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    # Values come from MemberRole.
    role: Mapped[str] = mapped_column(String(20))

    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<CompanyMember company_id={self.company_id} user_id={self.user_id}>"
