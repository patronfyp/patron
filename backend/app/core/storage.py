"""Storing uploaded files, behind one small interface.

Services ask for a `FileStorage` and call `save()` / `read()` / `delete()`
with a key like `cvs/<uuid>.pdf`; they never know where the bytes live. Local
disk is the only backend for now - moving to S3 or Cloudinary later is a new
class here, not a change in every service. Same idea as app/core/email.py.
"""

import asyncio
import re
from pathlib import Path
from typing import Protocol

from app.core.config import get_settings

# A key is one folder and one file name, both from a small safe alphabet - so
# a key built from user input can never climb out of the storage root
# (`../../etc/passwd`) or name a hidden file.
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
    """Keeps files in a folder on this machine (UPLOAD_DIR, default `uploads/`).

    Fine for development and a single server. Files are lost if the server's
    disk is - so production should switch to a cloud backend.
    """

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
    """FastAPI dependency returning the configured storage.

    Tests swap it out with `app.dependency_overrides[get_file_storage]`.
    """
    return LocalFileStorage(Path(get_settings().upload_dir))
