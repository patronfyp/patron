"""Database queries for the auth module. The only place SQL lives.

Functions here just fetch and store rows - no decisions about whether
something is allowed. That belongs in service.py.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import User
from .schemas import RegisterRequest


async def get_by_email(session: AsyncSession, email: str) -> User | None:
    """Look up a user by email. Caller is responsible for lowercasing first -
    though User.email is normalised on assignment regardless, so a query
    against an already-lowercase value is what actually matches."""
    stmt = select(User).where(User.email == email)
    return await session.scalar(stmt)


async def get_by_id(session: AsyncSession, user_id: int) -> User | None:
    return await session.get(User, user_id)


async def create_user(session: AsyncSession, payload: RegisterRequest, password_hash: str) -> User:
    """Insert a new user row. Assumes the duplicate-email check already ran -
    that decision belongs to the service, not here."""
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        role=payload.role.value,
        password=password_hash,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user
