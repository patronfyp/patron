"""Uploaded files behind one interface, keyed like `cvs/<uuid>.pdf`.

Local disk for now; a cloud backend would be a new class here.
"""

import asyncio
import re
from pathlib import Path
from typing import Protocol

from app.core.config import get_settings

# One folder and one file name from a safe alphabet - no `../` escapes.
_KEY_PATTERN = re.compile(r"^[a-z]+/[A-Za-z0-9-]+\.[a-z0-9]+$")


class FileStorage(Protocol):
    """Anything that can keep bytes under a key."""

    async def save(self, key: str, data: bytes) -> None: ...

    async def read(self, key: str) -> bytes | None: ...

    async def delete(self, key: str) -> None: ...


def _check_key(key: str) -> None:
    if not _KEY_PATTERN.fullmatch(key):
        raise ValueError(f"Invalid storage key: {key!r}")


class LocalFileStorage:
    """Files in UPLOAD_DIR on this machine. Fine for one server, not for scale."""

    def __init__(self, root: Path) -> None:
        self._root = root

    def _path(self, key: str) -> Path:
        _check_key(key)
        return self._root / key

    async def save(self, key: str, data: bytes) -> None:
        path = self._path(key)
        await asyncio.to_thread(path.parent.mkdir, parents=True, exist_ok=True)
        await asyncio.to_thread(path.write_bytes, data)

    async def read(self, key: str) -> bytes | None:
        path = self._path(key)
        if not await asyncio.to_thread(path.is_file):
            return None
        return await asyncio.to_thread(path.read_bytes)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self._path(key).unlink, missing_ok=True)


def get_file_storage() -> FileStorage:
    """FastAPI dependency: the configured storage. Tests override it."""
    return LocalFileStorage(Path(get_settings().upload_dir))
