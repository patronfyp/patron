"""add referrer onboarding fields to profiles

Revision ID: a3c9e1f2b7d4
Revises: 51a48d157e04
Create Date: 2026-10-16 23:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3c9e1f2b7d4"
down_revision: str | Sequence[str] | None = "51a48d157e04"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("profiles", sa.Column("job_title", sa.String(length=150), nullable=True))
    op.add_column("profiles", sa.Column("team", sa.String(length=100), nullable=True))
    op.add_column(
        "profiles",
        sa.Column(
            "referral_teams",
            sa.ARRAY(sa.String(length=20)),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
    )
    op.add_column(
        "profiles",
        sa.Column(
            "monthly_referral_limit", sa.Integer(), server_default=sa.text("5"), nullable=True
        ),
    )
    op.add_column(
        "profiles",
        sa.Column(
            "accept_alumni_requests", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
    )
    op.add_column(
        "profiles",
        sa.Column(
            "accept_any_verified_requests",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("profiles", "accept_any_verified_requests")
    op.drop_column("profiles", "accept_alumni_requests")
    op.drop_column("profiles", "monthly_referral_limit")
    op.drop_column("profiles", "referral_teams")
    op.drop_column("profiles", "team")
    op.drop_column("profiles", "job_title")
