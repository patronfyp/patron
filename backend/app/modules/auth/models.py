"""Accounts, their roles, and the ways to sign in to them.

A sign-in method (`UserIdentity`) and a role (`UserRoleAssignment`) are rows,
so adding either needs no migration. UUID keys stop anyone guessing ids.
"""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.core.database import Base


class UserRole(StrEnum):
    """What a person does on Patron (Module 1.3). A user can hold several.

    A varchar, not a Postgres enum: a new value needs no migration.
    """

    CANDIDATE = "candidate"  # "Get referred"
    REFERRER = "referrer"  # "Refer others"
    RECRUITER = "recruiter"  # "Hire talent"
    ADMIN = "admin"  # Patron staff - never self-assigned, see SignupRole


class SignupRole(StrEnum):
    """Roles a user may pick for themselves - never admin."""

    CANDIDATE = UserRole.CANDIDATE.value
    REFERRER = UserRole.REFERRER.value
    RECRUITER = UserRole.RECRUITER.value


class AuthProvider(StrEnum):
    """Identity providers we accept. Adding one adds a member here, nothing more."""

    LINKEDIN = "linkedin"


class User(Base):
    """A person with an account. A LinkedIn sign-up starts with no password and
    no roles - the role is asked for on first sign-in."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    # Always stored lowercase - see _normalise_email below.
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(150))
    avatar_url: Mapped[str | None] = mapped_column(Text, default=None)

    # A bcrypt hash; null for LinkedIn-only users. Never returned by any endpoint.
    password: Mapped[str | None] = mapped_column(String(255), default=None)

    is_email_verified: Mapped[bool] = mapped_column(default=False, server_default=text("false"))
    # Deactivated, never deleted: endorsements point at users (Module 13.2).
    is_active: Mapped[bool] = mapped_column(default=True, server_default=text("true"))

    # Tokens issued before this are refused - how a password change signs out
    # every session (Module 1.12).
    password_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    identities: Mapped[list["UserIdentity"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    # Loaded with the user: every request reads roles, and async forbids lazy loads.
    role_assignments: Mapped[list["UserRoleAssignment"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    @property
    def roles(self) -> list[str]:
        """The user's role names, in UserRole order - what UserRead returns."""
        held = {assignment.role for assignment in self.role_assignments}
        return [role.value for role in UserRole if role.value in held]

    @validates("email")
    def _normalise_email(self, _key: str, value: str | None) -> str | None:
        """Trim and lowercase on the model, so no code path can create
        `Ali@x.com` next to `ali@x.com`."""
        if value is None:
            return None
        return value.strip().lower()

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r}>"


class UserRoleAssignment(Base):
    """One role held by one user. (user_id, role) is the key, so no duplicates."""

    __tablename__ = "user_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    # Values come from UserRole.
    role: Mapped[str] = mapped_column(String(20), primary_key=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="role_assignments")

    def __repr__(self) -> str:
        return f"<UserRoleAssignment user_id={self.user_id} role={self.role!r}>"


class UserIdentity(Base):
    """One provider account linked to one user. Matched on provider id, never
    email, which the person can change at the provider."""

    __tablename__ = "user_identities"
    __table_args__ = (
        UniqueConstraint(
            "provider",
            "provider_user_id",
            name="uq_user_identities_provider_user_id",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    # Values come from AuthProvider.
    provider: Mapped[str] = mapped_column(String(20))
    # The provider's own stable id for this person - LinkedIn's `sub` claim.
    provider_user_id: Mapped[str] = mapped_column(String(255))
    # For reference only - User.email is the real one.
    provider_email: Mapped[str | None] = mapped_column(String(255), default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="identities")

    def __repr__(self) -> str:
        return f"<UserIdentity id={self.id} provider={self.provider!r} user_id={self.user_id}>"


class PasswordResetToken(Base):
    """One emailed reset link (Module 1.12). Only its hash is stored."""

    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    # SHA-256 of the token in the link.
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    # Set on use, or when a newer link replaces it - makes the link single-use.
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<PasswordResetToken id={self.id} user_id={self.user_id}>"
