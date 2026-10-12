"""Fixtures shared by every test in this directory and below.

pytest finds this file by name - tests never import it. Anything declared here
as a fixture can be requested by any test just by naming it as an argument.
"""

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.storage import get_file_storage
from db import engine
from main import app


@pytest.fixture(autouse=True)
async def _close_database_connections() -> AsyncIterator[None]:
    """Return pooled database connections before the test's event loop closes.

    `autouse=True` means this runs for every test without being asked for.

    The engine in db.py is created once at import time, and its connection pool
    holds connections that belong to whichever event loop first used them.
    pytest-asyncio gives each test a fresh event loop, so without this the
    second test inherits a connection tied to the previous - now closed - loop
    and fails with "Event loop is closed".

    Disposing after each test keeps every test independent, which is the point.
    """
    yield
    await engine.dispose()


@pytest.fixture
async def clean_users_table() -> AsyncIterator[None]:
    """Empties users (and, via cascade, every table that points at it) before
    the test runs.

    Tests hit the real configured database - there is no separate test DB yet
    locally, only in CI. Without this, a test asserting "this email is free"
    can fail because a previous manual run or test left a row behind, and
    tests would stop being independent of each other and of run order.
    """
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE TABLE users CASCADE"))
    yield


class MemoryStorage:
    """Stands in for app/core/storage.py's LocalFileStorage, so tests never
    write to disk. `files` maps key -> bytes for assertions."""

    def __init__(self) -> None:
        self.files: dict[str, bytes] = {}

    async def save(self, key: str, data: bytes) -> None:
        self.files[key] = data

    async def read(self, key: str) -> bytes | None:
        return self.files.get(key)

    async def delete(self, key: str) -> None:
        self.files.pop(key, None)


@pytest.fixture
async def storage() -> AsyncIterator[MemoryStorage]:
    memory = MemoryStorage()
    app.dependency_overrides[get_file_storage] = lambda: memory
    yield memory
    app.dependency_overrides.pop(get_file_storage, None)


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """An HTTP client wired directly into the app.

    ASGITransport calls FastAPI in-process, so no server has to be running and
    nothing goes over the network. Tests are fast and cannot fail because a port
    was busy.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        yield http
