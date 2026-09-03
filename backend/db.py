"""Database engine, session factory, and the per-request session dependency.

Every ORM model inherits from `Base`, and every endpoint that touches the
database asks for a session via `Depends(get_session)`.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import get_settings

settings = get_settings()

# One engine per process. It owns the connection pool, so it must not be
# created per request.
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,  # log every SQL statement while DEBUG=true
    pool_pre_ping=True,  # check a pooled connection is still alive before use
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autoflush=False,
    # Keeps attributes readable after commit(), which would otherwise expire
    # them and trigger a surprise query (or fail) when the response is built.
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models.

    Alembic reads `Base.metadata` to work out which tables should exist, so any
    model that is not imported before Alembic runs is invisible to migrations.
    """


async def get_session() -> AsyncGenerator[AsyncSession]:
    """FastAPI dependency: one session per request, always closed afterwards."""
    async with SessionLocal() as session:
        yield session
