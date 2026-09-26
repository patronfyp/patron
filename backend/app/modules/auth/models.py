"""Authentication models: the account, and the ways it can be signed into.

`User` is the person. `UserIdentity` is one way that person authenticates -
LinkedIn today (Module 1.1), possibly Google or GitHub later. Keeping them in
separate tables means adding a provider is a new row value rather than a schema
migration, and one person can hold several sign-in methods against a single
account.
"""

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

from db import Base


class UserRole(StrEnum):
    """What the user signed up as - Module 1.3.

    Stored as a plain string column rather than a PostgreSQL enum type: adding a
    value to a database enum needs a migration and locks the table, whereas a
    varchar with this class as the source of truth does not.
    """

    CANDIDATE = "candidate"
    COMPANY = "company"
    BOTH = "both"


class AuthProvider(StrEnum):
    """Identity providers we accept. Adding one adds a member here, nothing more."""

    LINKEDIN = "linkedin"


class User(Base):
    """A person with an account.

    Both `password` and `role` are nullable, and both for the same reason:
    a LinkedIn sign-up supplies neither. A LinkedIn-only user has no password at
    all, and LinkedIn does not tell us whether someone is a candidate or a
    company - so the role is asked for once, on first sign-in.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Always stored lowercase - see _normalise_email below.
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(150))
    avatar_url: Mapped[str | None] = mapped_column(Text, default=None)

    # Values come from UserRole. Null until the user picks one.
    role: Mapped[str | None] = mapped_column(String(20), default=None)

    # Holds a bcrypt hash, never a plain-text password. Null for a user who
    # only ever signs in through a provider.
    # This column must never be returned by any endpoint - see STANDARDS.md 3.4.
    password: Mapped[str | None] = mapped_column(String(255), default=None)

    is_email_verified: Mapped[bool] = mapped_column(default=False, server_default=text("false"))
    # Soft delete / ban (Module 13.2). Rows are deactivated, never deleted,
    # because endorsements reference them as an audit trail.
    is_active: Mapped[bool] = mapped_column(default=True, server_default=text("true"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    identities: Mapped[list["UserIdentity"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

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

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

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
