"""Database queries for the verification module. The only place SQL lives.

Functions here just fetch and store rows - no decisions about whether
something is allowed. That belongs in service.py.
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import EmailVerification


async def get_latest(
    session: AsyncSession, user_id: int, email: str, kind: str
) -> EmailVerification | None:
    """The most recent code sent to this address for this purpose.

    Only the latest one counts: sending a new code makes every older one for
    the same address unusable.
    """
    stmt = (
        select(EmailVerification)
        .where(
            EmailVerification.user_id == user_id,
            EmailVerification.email == email,
            EmailVerification.kind == kind,
        )
        .order_by(EmailVerification.created_at.desc(), EmailVerification.id.desc())
        .limit(1)
    )
    return await session.scalar(stmt)


async def create(
    session: AsyncSession,
    *,
    user_id: int,
    email: str,
    kind: str,
    code_hash: str,
    expires_at: datetime,
) -> EmailVerification:
    row = EmailVerification(
        user_id=user_id, email=email, kind=kind, code_hash=code_hash, expires_at=expires_at
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def delete(session: AsyncSession, row: EmailVerification) -> None:
    await session.delete(row)
    await session.commit()


async def save(session: AsyncSession, row: EmailVerification) -> EmailVerification:
    """Persist changes already applied to a loaded row."""
    await session.commit()
    await session.refresh(row)
    return row
