"""Tests for the Resend sender, the email layout and the production guard (#111, ADR 0022)."""

import json
import logging

import httpx
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core.email import EmailDeliveryError, ResendEmailSender
from app.core.email_layout import compose

API_KEY = "re_test_key_never_logged"


def _sender(handler) -> ResendEmailSender:
    return ResendEmailSender(API_KEY, transport=httpx.MockTransport(handler))


async def test_resend_gets_the_text_html_and_key() -> None:
    seen: list[httpx.Request] = []

    def accept(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"id": "email-1"})

    await _sender(accept).send("ayesha@garner.com", "Hello", "Plain body", html="<p>Hi</p>")

    request = seen[0]
    payload = json.loads(request.content)
    assert request.url == "https://api.resend.com/emails"
    assert request.headers["Authorization"] == f"Bearer {API_KEY}"
    assert payload["to"] == ["ayesha@garner.com"]
    assert payload["text"] == "Plain body"
    assert payload["html"] == "<p>Hi</p>"


async def test_a_refusal_raises_and_never_logs_the_key(caplog: pytest.LogCaptureFixture) -> None:
    def refuse(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"message": "You can only send testing emails to yourself"})

    with caplog.at_level(logging.ERROR), pytest.raises(EmailDeliveryError):
        await _sender(refuse).send("someone@example.com", "Hello", "Your code is 123456")

    assert "testing emails" in caplog.text
    assert API_KEY not in caplog.text
    assert "123456" not in caplog.text


async def test_no_connection_is_a_delivery_error_not_a_crash() -> None:
    def offline(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("timed out", request=request)

    with pytest.raises(EmailDeliveryError):
        await _sender(offline).send("ayesha@garner.com", "Hello", "Body")


def test_the_layout_escapes_what_users_type() -> None:
    email = compose(
        subject="Join <b>Evil</b> on PATRON",
        heading="Join <script>alert(1)</script>",
        lines=['<a href="https://phish.example">Click</a> invited you'],
        button=("Accept", "https://patron.example/register?invite=a&b=c"),
        footer="Ignore it",
    )

    assert "<script>" not in email.html
    assert '<a href="https://phish.example">' not in email.html
    assert "&lt;script&gt;" in email.html
    assert "invite=a&amp;b=c" in email.html
    # The plain-text version keeps the link exactly, for clients without HTML.
    assert "https://patron.example/register?invite=a&b=c" in email.text


def test_the_code_is_in_both_versions() -> None:
    email = compose(subject="s", heading="h", lines=["l"], code="482913", footer="f")

    assert "482913" in email.text
    assert "482913" in email.html


def test_production_refuses_the_console_backend() -> None:
    with pytest.raises(ValidationError, match="EMAIL_BACKEND=console"):
        Settings(
            secret_key="x" * 32,
            database_url="postgresql+asyncpg://u:p@localhost/db",
            app_env="production",
            email_backend="console",
        )
