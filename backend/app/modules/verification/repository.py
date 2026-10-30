"""Database queries for verification - no business decisions here."""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import EmailVerification, VerificationDocument


async def get_latest(
    session: AsyncSession, user_id: uuid.UUID, email: str, kind: str
) -> EmailVerification | None:
    """The latest code for this address and kind - the only one that counts."""
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


async def get_latest_verified(
    session: AsyncSession, user_id: uuid.UUID, kind: str
) -> EmailVerification | None:
    """The most recently verified address of this kind, whatever the address."""
    stmt = (
        select(EmailVerification)
        .where(
            EmailVerification.user_id == user_id,
            EmailVerification.kind == kind,
            EmailVerification.verified_at.is_not(None),
        )
        .order_by(EmailVerification.verified_at.desc())
        .limit(1)
    )
    return await session.scalar(stmt)


async def list_verified_emails(session: AsyncSession, user_id: uuid.UUID, kind: str) -> list[str]:
    """Every address of this kind the user has verified."""
    stmt = select(EmailVerification.email).where(
        EmailVerification.user_id == user_id,
        EmailVerification.kind == kind,
        EmailVerification.verified_at.is_not(None),
    )
    return list(await session.scalars(stmt))


async def create(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
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
    """Persist changes already applied to a loaded row - and anything else
    changed in the same session, such as the user's verified flag."""
    await session.commit()
    await session.refresh(row)
    return row


async def list_documents(session: AsyncSession, user_id: uuid.UUID) -> list[VerificationDocument]:
    """The user's documents, newest first."""
    stmt = (
        select(VerificationDocument)
        .where(VerificationDocument.user_id == user_id)
        .order_by(VerificationDocument.created_at.desc())
    )
    return list((await session.scalars(stmt)).all())


async def create_document(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    kind: str,
    file_key: str,
    filename: str,
    size_bytes: int,
) -> VerificationDocument:
    row = VerificationDocument(
        user_id=user_id, kind=kind, file_key=file_key, filename=filename, size_bytes=size_bytes
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row
