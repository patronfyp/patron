"""Database queries for companies - no business decisions here."""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Company, CompanyInvite, CompanyMember


async def get_by_domain(session: AsyncSession, domain: str) -> Company | None:
    return await session.scalar(select(Company).where(Company.domain == domain))


async def get_membership(
    session: AsyncSession, user_id: uuid.UUID
) -> tuple[Company, CompanyMember] | None:
    """The user's company and membership row, in one query."""
    stmt = (
        select(Company, CompanyMember)
        .join(CompanyMember, CompanyMember.company_id == Company.id)
        .where(CompanyMember.user_id == user_id)
        .limit(1)
    )
    row = (await session.execute(stmt)).first()
    return (row[0], row[1]) if row else None


async def create_with_owner(
    session: AsyncSession, company: Company, owner_id: uuid.UUID, role: str
) -> Company:
    """Insert the company and its first member in one transaction."""
    session.add(company)
    await session.flush()
    session.add(CompanyMember(company_id=company.id, user_id=owner_id, role=role))
    await session.commit()
    await session.refresh(company)
    return company


async def add_member(
    session: AsyncSession, company_id: uuid.UUID, user_id: uuid.UUID, role: str
) -> CompanyMember:
    member = CompanyMember(company_id=company_id, user_id=user_id, role=role)
    session.add(member)
    await session.commit()
    await session.refresh(member)
    return member


async def save(session: AsyncSession, company: Company) -> Company:
    """Persist changes already applied to a loaded company."""
    await session.commit()
    await session.refresh(company)
    return company


async def is_member(session: AsyncSession, company_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    stmt = select(CompanyMember.user_id).where(
        CompanyMember.company_id == company_id, CompanyMember.user_id == user_id
    )
    return await session.scalar(stmt) is not None


async def get_pending_invite(
    session: AsyncSession, company_id: uuid.UUID, email: str
) -> CompanyInvite | None:
    stmt = select(CompanyInvite).where(
        CompanyInvite.company_id == company_id,
        CompanyInvite.email == email,
        CompanyInvite.accepted_at.is_(None),
    )
    return await session.scalar(stmt)


async def get_invite(
    session: AsyncSession, company_id: uuid.UUID, invite_id: uuid.UUID
) -> CompanyInvite | None:
    stmt = select(CompanyInvite).where(
        CompanyInvite.company_id == company_id, CompanyInvite.id == invite_id
    )
    return await session.scalar(stmt)


async def get_invite_by_hash(
    session: AsyncSession, token_hash: str
) -> tuple[CompanyInvite, Company] | None:
    """The invite for a token and its company, in one query."""
    stmt = (
        select(CompanyInvite, Company)
        .join(Company, Company.id == CompanyInvite.company_id)
        .where(CompanyInvite.token_hash == token_hash)
    )
    row = (await session.execute(stmt)).first()
    return (row[0], row[1]) if row else None


async def list_invites(
    session: AsyncSession, company_id: uuid.UUID, limit: int
) -> list[CompanyInvite]:
    """Newest first, at most `limit`."""
    stmt = (
        select(CompanyInvite)
        .where(CompanyInvite.company_id == company_id)
        .order_by(CompanyInvite.created_at.desc(), CompanyInvite.id.desc())
        .limit(limit)
    )
    return list(await session.scalars(stmt))


async def add_invite(session: AsyncSession, invite: CompanyInvite) -> CompanyInvite:
    session.add(invite)
    await session.commit()
    await session.refresh(invite)
    return invite


async def save_invite(session: AsyncSession, invite: CompanyInvite) -> CompanyInvite:
    await session.commit()
    await session.refresh(invite)
    return invite


async def delete_invite(session: AsyncSession, invite: CompanyInvite) -> None:
    await session.delete(invite)
    await session.commit()


async def accept_invite(
    session: AsyncSession, invite: CompanyInvite, user_id: uuid.UUID, accepted_at: datetime
) -> None:
    """Add the member and close the invite in one commit. The caller also
    changes the user (role, verified email) in the same session."""
    session.add(CompanyMember(company_id=invite.company_id, user_id=user_id, role=invite.role))
    invite.accepted_at = accepted_at
    await session.commit()
