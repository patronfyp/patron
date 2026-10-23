"""Test doubles shared across test folders."""


class MemoryStorage:
    """In-memory FileStorage, so tests never write to disk. `files` maps key -> bytes."""

    def __init__(self) -> None:
        self.files: dict[str, bytes] = {}

    async def save(self, key: str, data: bytes) -> None:
        self.files[key] = data

    async def read(self, key: str) -> bytes | None:
        return self.files.get(key)

    async def delete(self, key: str) -> None:
        self.files.pop(key, None)
