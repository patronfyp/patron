"""Database queries for the profiles module. The only place SQL lives.

Functions here just fetch and store rows - no decisions about whether
something is allowed. That belongs in service.py.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Profile


async def get_by_user_id(session: AsyncSession, user_id: int) -> Profile | None:
    stmt = select(Profile).where(Profile.user_id == user_id)
    return await session.scalar(stmt)


async def create_for_user(session: AsyncSession, user_id: int) -> Profile:
    """Insert an empty profile at step 1. Assumes none exists yet - checking
    that is the service's decision."""
    profile = Profile(user_id=user_id)
    session.add(profile)
    await session.commit()
    await session.refresh(profile)
    return profile


async def save(session: AsyncSession, profile: Profile) -> Profile:
    """Persist changes already applied to a loaded profile."""
    await session.commit()
    await session.refresh(profile)
    return profile
