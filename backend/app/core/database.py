"""Database engine, session factory, ORM `Base`, and `get_session`."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

# One per process - it owns the connection pool.
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,  # log every SQL statement while DEBUG=true
    pool_pre_ping=True,  # check a pooled connection is still alive before use
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autoflush=False,
    # Attributes stay readable after commit, with no surprise query.
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base for all ORM models. Alembic only sees models imported in migrations/env.py."""


async def get_session() -> AsyncGenerator[AsyncSession]:
    """FastAPI dependency: one session per request, always closed afterwards."""
    async with SessionLocal() as session:
        yield session
