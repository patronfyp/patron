"""Sending email behind one interface: services call `EmailSender.send()` and
never know which provider is behind it."""

import logging
from typing import Protocol

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class EmailSender(Protocol):
    """Anything that can deliver a plain-text email."""

    async def send(self, to: str, subject: str, body: str) -> None: ...


class ConsoleEmailSender:
    """Logs the email instead of sending it. Development only - the log would
    hold working codes and reset links."""

    async def send(self, to: str, subject: str, body: str) -> None:
        logger.warning(
            "EMAIL (console backend, not sent)\nFrom: %s\nTo: %s\nSubject: %s\n\n%s",
            get_settings().email_from,
            to,
            subject,
            body,
        )


class EmailDeliveryError(Exception):
    """The provider refused or failed to accept the message."""


class ResendEmailSender:
    """Sends through Resend. Until our domain is verified there, it only
    delivers to the Resend account's own address."""

    _URL = "https://api.resend.com/emails"

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    async def send(self, to: str, subject: str, body: str) -> None:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                self._URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "from": get_settings().email_from,
                    "to": [to],
                    "subject": subject,
                    "text": body,
                },
            )
        if response.is_error:
            # Resend's body names the cause; the user only sees a generic error.
            logger.error("Resend rejected an email (%s): %s", response.status_code, response.text)
            raise EmailDeliveryError(f"Resend returned {response.status_code}")


def get_email_sender() -> EmailSender:
    """FastAPI dependency: the configured sender. Tests override it."""
    settings = get_settings()
    if settings.email_backend == "console":
        return ConsoleEmailSender()
    if settings.email_backend == "resend":
        if not settings.resend_api_key:
            raise RuntimeError("EMAIL_BACKEND=resend but RESEND_API_KEY is empty in .env")
        return ResendEmailSender(settings.resend_api_key)
    # Unreachable today; fails loudly if a new backend value gets no class.
    raise RuntimeError(f"Unknown EMAIL_BACKEND: {settings.email_backend!r}")
