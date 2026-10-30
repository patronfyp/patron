"""Database queries for companies - no business decisions here."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Company, CompanyMember


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
