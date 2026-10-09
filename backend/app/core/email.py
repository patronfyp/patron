"""Sending email, behind one small interface.

Services ask for an `EmailSender` and call `send()`; they never know whether
the message went to a real inbox or to the log. That keeps every flow that
emails someone - verification codes (#49), password reset (#50) - buildable
and testable before a real provider is chosen, and makes adding one a new
class here rather than a change in every service.
"""

import logging
from typing import Protocol

import httpx

from config import get_settings

logger = logging.getLogger(__name__)


class EmailSender(Protocol):
    """Anything that can deliver a plain-text email."""

    async def send(self, to: str, subject: str, body: str) -> None: ...


class ConsoleEmailSender:
    """Writes the email to the log instead of sending it.

    The default in development: a developer reads the verification code from
    the terminal running uvicorn. Never select this in production - the log
    would then hold working codes and reset links.
    """

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
    """Sends through Resend's HTTP API (https://resend.com/docs/api-reference).

    Until a domain is verified in Resend, it only delivers *to the address
    the Resend account was created with*, and only *from*
    `onboarding@resend.dev` - fine for testing, not for real users.
    """

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
            # Resend's error body names the problem (bad key, unverified
            # domain, recipient not allowed) - log it, since the user only
            # sees a generic failure. It never contains the email body.
            logger.error("Resend rejected an email (%s): %s", response.status_code, response.text)
            raise EmailDeliveryError(f"Resend returned {response.status_code}")


def get_email_sender() -> EmailSender:
    """FastAPI dependency returning the configured sender.

    Tests swap it out with `app.dependency_overrides[get_email_sender]`.
    """
    settings = get_settings()
    if settings.email_backend == "console":
        return ConsoleEmailSender()
    if settings.email_backend == "resend":
        if not settings.resend_api_key:
            raise RuntimeError("EMAIL_BACKEND=resend but RESEND_API_KEY is empty in .env")
        return ResendEmailSender(settings.resend_api_key)
    # Unreachable while `email_backend` is a Literal of the values above; here
    # so that adding a value without a class here fails loudly.
    raise RuntimeError(f"Unknown EMAIL_BACKEND: {settings.email_backend!r}")
