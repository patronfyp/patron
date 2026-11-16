"""Test doubles shared across test folders."""

import re

from app.core.email import EmailDeliveryError


class RecordingSender:
    """Stands in for the real email sender and keeps every email it was given."""

    def __init__(self) -> None:
        self.sent: list[dict[str, str]] = []
        # Set to make the next send behave like the provider refusing it.
        self.fail_next = False

    async def send(self, to: str, subject: str, body: str) -> None:
        if self.fail_next:
            self.fail_next = False
            raise EmailDeliveryError("provider refused")
        self.sent.append({"to": to, "subject": subject, "body": body})

    def last_code(self) -> str:
        return re.search(r"\b\d{6}\b", self.sent[-1]["body"]).group()

    def last_token(self) -> str:
        """The token in the last password-reset link."""
        return re.search(r"reset-password\?token=(\S+)", self.sent[-1]["body"]).group(1)


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
