"""Fixtures for every test. pytest loads this file by name; tests never import it."""

from collections.abc import AsyncIterator, Iterator

import pytest
from fakeredis.aioredis import FakeRedis
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.database import engine
from app.core.email import get_email_sender
from app.core.rate_limit import RateLimiter, get_rate_limiter
from app.core.storage import get_file_storage
from app.main import app
from tests.fakes import MemoryStorage, RecordingSender


@pytest.fixture(autouse=True)
async def _close_database_connections() -> AsyncIterator[None]:
    """Dispose the pool after each test: pooled connections belong to the
    previous test's (now closed) event loop."""
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
def _no_rate_limits() -> Iterator[None]:
    """Limits off by default: many tests sign up several users from one "IP".
    Tests of the limits themselves use the `limiter` fixture instead."""
    app.dependency_overrides[get_rate_limiter] = lambda: RateLimiter(None)
    yield
    app.dependency_overrides.pop(get_rate_limiter, None)


@pytest.fixture
async def redis() -> AsyncIterator[FakeRedis]:
    """An in-memory Redis, empty for each test."""
    fake = FakeRedis()
    yield fake
    await fake.aclose()


@pytest.fixture
def limiter(redis: FakeRedis) -> RateLimiter:
    """Turn rate limits on, counting in the fake Redis."""
    real = RateLimiter(redis)
    app.dependency_overrides[get_rate_limiter] = lambda: real
    return real


@pytest.fixture
async def clean_users_table() -> AsyncIterator[None]:
    """Empty users, and by cascade everything linked to them, before the test."""
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE TABLE users CASCADE"))
    yield


@pytest.fixture
async def storage() -> AsyncIterator[MemoryStorage]:
    """Swap the app's file storage for an in-memory one."""
    memory = MemoryStorage()
    app.dependency_overrides[get_file_storage] = lambda: memory
    yield memory
    app.dependency_overrides.pop(get_file_storage, None)


@pytest.fixture
async def sender() -> AsyncIterator[RecordingSender]:
    """Swap the app's email sender for one that records every email."""
    recording = RecordingSender()
    app.dependency_overrides[get_email_sender] = lambda: recording
    yield recording
    app.dependency_overrides.pop(get_email_sender, None)


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """An HTTP client that calls the app in-process - no server, no network."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        yield http
