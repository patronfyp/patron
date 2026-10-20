"""Authentication models: the account, its roles, and the ways it can be
signed into.

`User` is the person. `UserIdentity` is one way that person authenticates -
LinkedIn today (Module 1.1), possibly Google or GitHub later. Keeping them in
separate tables means adding a provider is a new row value rather than a schema
migration, and one person can hold several sign-in methods against a single
account. `UserRoleAssignment` works the same way for roles.

Primary keys are UUIDs, not sequential integers: an id that appears in a URL
(`/users/<id>`) must not let anyone count users or guess the next one.
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
    """What a person does on Patron - Module 1.3. One user can hold several.

    The first three are the "I want to" cards on the Create account screen;
    an employee who refers people, hires for their team and is job-hunting
    themselves holds all three.

    Stored as a plain string column rather than a PostgreSQL enum type: adding a
    value to a database enum needs a migration and locks the table, whereas a
    varchar with this class as the source of truth does not.
    """

    CANDIDATE = "candidate"  # "Get referred"
    REFERRER = "referrer"  # "Refer others"
    RECRUITER = "recruiter"  # "Hire talent"
    ADMIN = "admin"  # Patron staff - never self-assigned, see SignupRole


class SignupRole(StrEnum):
    """The roles a user may give themselves. Admin is deliberately missing:
    it is granted by Patron, never picked at sign-up or through POST
    /auth/role."""

    CANDIDATE = UserRole.CANDIDATE.value
    REFERRER = UserRole.REFERRER.value
    RECRUITER = UserRole.RECRUITER.value


class AuthProvider(StrEnum):
    """Identity providers we accept. Adding one adds a member here, nothing more."""

    LINKEDIN = "linkedin"


class User(Base):
    """A person with an account.

    A LinkedIn sign-up arrives with no password and no roles: a LinkedIn-only
    user has no password at all, and LinkedIn does not tell us what someone
    wants to do on Patron - so a role is asked for once, on first sign-in.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    # Always stored lowercase - see _normalise_email below.
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(150))
    avatar_url: Mapped[str | None] = mapped_column(Text, default=None)

    # Holds a bcrypt hash, never a plain-text password. Null for a user who
    # only ever signs in through a provider.
    # This column must never be returned by any endpoint - see STANDARDS.md 3.4.
    password: Mapped[str | None] = mapped_column(String(255), default=None)

    is_email_verified: Mapped[bool] = mapped_column(default=False, server_default=text("false"))
    # Soft delete / ban (Module 13.2). Rows are deactivated, never deleted,
    # because endorsements reference them as an audit trail.
    is_active: Mapped[bool] = mapped_column(default=True, server_default=text("true"))

    # Set when the password is reset (Module 1.12). Any token issued before
    # this moment is refused, which is how a reset signs out every existing
    # session - JWTs are not stored, so there is nothing else to revoke.
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
    # selectin: every authenticated request reads the roles, so load them with
    # the user rather than on first access (which async SQLAlchemy forbids).
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
        """Lowercase and trim on the way in, so uniqueness actually holds.

        Without this, `Ali@x.com` and `ali@x.com` create two accounts and
        password reset stops making sense. Doing it on the model rather than in
        one service means no code path can bypass it.
        """
        if value is None:
            return None
        return value.strip().lower()

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r}>"


class UserRoleAssignment(Base):
    """One role held by one user - a row per role, so a user can hold several.

    The (user_id, role) pair is the primary key: the same role cannot be held
    twice, and there is nothing else a row needs to be identified by.
    """

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
    """One provider account linked to one user.

    A returning user is matched on `(provider, provider_user_id)` - never on
    email, which a person can change at the provider.
    """

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
    # What the provider reported, kept for reference. Authoritative email lives
    # on User; these can drift apart.
    provider_email: Mapped[str | None] = mapped_column(String(255), default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="identities")

    def __repr__(self) -> str:
        return f"<UserIdentity id={self.id} provider={self.provider!r} user_id={self.user_id}>"


class PasswordResetToken(Base):
    """One emailed password-reset link - Module 1.12.

    Only a hash of the token is stored, so a leaked table cannot be turned
    into working reset links.
    """

    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    # SHA-256 hex digest of the token in the link. Unique so a lookup by hash
    # finds at most one row.
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    # Set when the token is used, or when a newer link replaces it. Either
    # way the token stops working - that is what makes it single-use.
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<PasswordResetToken id={self.id} user_id={self.user_id}>"
