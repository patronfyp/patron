"""Fixtures for every test. pytest loads this file by name; tests never import it."""

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.database import engine
from app.core.storage import get_file_storage
from app.main import app
from tests.fakes import MemoryStorage


@pytest.fixture(autouse=True)
async def _close_database_connections() -> AsyncIterator[None]:
    """Dispose the pool after each test: pooled connections belong to the
    previous test's (now closed) event loop."""
    yield
    await engine.dispose()


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
async def client() -> AsyncIterator[AsyncClient]:
    """An HTTP client that calls the app in-process - no server, no network."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        yield http
