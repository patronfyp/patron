"""switch to uuid primary keys and add user_roles

Every table moves from integer to UUID primary keys, and the single
`users.role` column (candidate / company / both) is replaced by a `user_roles`
table so one user can hold several of candidate, referrer, recruiter and admin.

The tables are dropped and recreated rather than converted: there is no real
data yet, only local test accounts, and converting integer keys and every
foreign key pointing at them in place is far more code for nothing.
**Running this deletes every row in these tables** - sign up again afterwards.
Downgrading does the same in reverse.

Revision ID: c0ad113ca895
Revises: d05343ccc91c
Create Date: 2026-10-12 10:20:01.330380

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c0ad113ca895"
down_revision: str | Sequence[str] | None = "d05343ccc91c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _now() -> sa.TextClause:
    return sa.text("now()")


def _create_tables(id_type: type[sa.types.TypeEngine], *, roles_table: bool) -> None:
    """Create the five tables with `id_type` keys.

    `roles_table=True` is the new schema (a `user_roles` table); False is the
    old one (a `users.role` column). Everything else is identical, so both
    directions share this one definition.
    """
    users_columns = [
        sa.Column("id", id_type(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("avatar_url", sa.Text(), nullable=True),
    ]
    if not roles_table:
        users_columns.append(sa.Column("role", sa.String(length=20), nullable=True))
    users_columns += [
        sa.Column("password", sa.String(length=255), nullable=True),
        sa.Column(
            "is_email_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    ]
    op.create_table("users", *users_columns)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    if roles_table:
        op.create_table(
            "user_roles",
            sa.Column("user_id", id_type(), nullable=False),
            sa.Column("role", sa.String(length=20), nullable=False),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("user_id", "role"),
        )

    op.create_table(
        "user_identities",
        sa.Column("id", id_type(), nullable=False),
        sa.Column("user_id", id_type(), nullable=False),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("provider_user_id", sa.String(length=255), nullable=False),
        sa.Column("provider_email", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.Column(
            "last_login_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "provider", "provider_user_id", name="uq_user_identities_provider_user_id"
        ),
    )
    op.create_index(
        op.f("ix_user_identities_user_id"), "user_identities", ["user_id"], unique=False
    )

    op.create_table(
        "profiles",
        sa.Column("id", id_type(), nullable=False),
        sa.Column("user_id", id_type(), nullable=False),
        sa.Column("university", sa.String(length=200), nullable=True),
        sa.Column("degree", sa.String(length=150), nullable=True),
        sa.Column("graduation_year", sa.Integer(), nullable=True),
        sa.Column("employer_name", sa.String(length=200), nullable=True),
        sa.Column("onboarding_step", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_profiles_user_id"), "profiles", ["user_id"], unique=True)

    op.create_table(
        "email_verifications",
        sa.Column("id", id_type(), nullable=False),
        sa.Column("user_id", id_type(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("code_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_email_verifications_user_id"), "email_verifications", ["user_id"], unique=False
    )

    op.create_table(
        "password_reset_tokens",
        sa.Column("id", id_type(), nullable=False),
        sa.Column("user_id", id_type(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(
        op.f("ix_password_reset_tokens_user_id"), "password_reset_tokens", ["user_id"], unique=False
    )


def _drop_tables(*, roles_table: bool) -> None:
    """Drop every table, children before `users`. Indexes go with their table."""
    op.drop_table("password_reset_tokens")
    op.drop_table("email_verifications")
    op.drop_table("profiles")
    op.drop_table("user_identities")
    if roles_table:
        op.drop_table("user_roles")
    op.drop_table("users")


def upgrade() -> None:
    """Upgrade schema."""
    _drop_tables(roles_table=False)
    _create_tables(sa.Uuid, roles_table=True)


def downgrade() -> None:
    """Downgrade schema."""
    _drop_tables(roles_table=True)
    _create_tables(sa.Integer, roles_table=False)
