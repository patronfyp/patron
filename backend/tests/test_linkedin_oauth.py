"""Unit tests for the CSRF-state helpers and the LinkedIn API client behind
LinkedIn OAuth (#25). No PKCE - see ADR 0014.

No database or network involved - these are pure functions, or use
httpx.MockTransport in place of the real LinkedIn API. The full authorize/
callback flow is covered separately in tests/test_auth_linkedin.py.
"""

from datetime import UTC, datetime, timedelta

import httpx
import jwt
import pytest

from app.core.exceptions import UnauthorizedError
from app.modules.auth import linkedin
from config import get_settings


def test_state_token_round_trips() -> None:
    token = linkedin.create_state_token()

    payload = linkedin.decode_state_token(token)

    assert "nonce" in payload


def test_state_tokens_are_unique_per_call() -> None:
    assert linkedin.create_state_token() != linkedin.create_state_token()


def test_state_token_rejects_tampering() -> None:
    token = linkedin.create_state_token()

    with pytest.raises(jwt.PyJWTError):
        linkedin.decode_state_token(token + "tampered")


def test_state_token_rejects_expiry() -> None:
    settings = get_settings()
    now = datetime.now(UTC)
    expired = jwt.encode(
        {
            "nonce": "some-nonce",
            "iat": now - timedelta(minutes=10),
            "exp": now - timedelta(minutes=5),
        },
        settings.secret_key,
        algorithm="HS256",
    )

    with pytest.raises(jwt.PyJWTError):
        linkedin.decode_state_token(expired)


def test_build_authorize_url_carries_state() -> None:
    url = linkedin.build_authorize_url(state="the-state-token")

    assert url.startswith("https://www.linkedin.com/oauth/v2/authorization?")
    assert "state=the-state-token" in url
    assert "response_type=code" in url
    # No PKCE (ADR 0014) - LinkedIn's token endpoint rejects a code_verifier
    # with invalid_client, not a PKCE-specific error.
    assert "code_challenge" not in url


def _mock_transport(
    *, token_response=None, token_status=200, userinfo_response=None, userinfo_status=200
):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/oauth/v2/accessToken":
            return httpx.Response(token_status, json=token_response or {})
        if request.url.path == "/v2/userinfo":
            return httpx.Response(userinfo_status, json=userinfo_response or {})
        raise AssertionError(f"Unexpected request to {request.url}")

    return httpx.MockTransport(handler)


async def test_exchange_code_for_access_token_returns_the_token() -> None:
    transport = _mock_transport(token_response={"access_token": "tok-123"})

    async with httpx.AsyncClient(transport=transport) as client:
        token = await linkedin._exchange_code_for_access_token(client, code="the-code")

    assert token == "tok-123"


async def test_exchange_code_rejects_a_non_200_response() -> None:
    transport = _mock_transport(token_status=400, token_response={"error": "invalid_grant"})

    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(UnauthorizedError):
            await linkedin._exchange_code_for_access_token(client, code="bad-code")


async def test_exchange_code_rejects_a_response_with_no_access_token() -> None:
    transport = _mock_transport(token_response={"unexpected": "shape"})

    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(UnauthorizedError):
            await linkedin._exchange_code_for_access_token(client, code="the-code")


async def test_fetch_userinfo_maps_linkedin_claims_to_our_own_fields() -> None:
    transport = _mock_transport(
        userinfo_response={
            "sub": "li-user-1",
            "email": "jane@example.com",
            "email_verified": True,
            "name": "Jane Doe",
            "picture": "https://example.com/jane.jpg",
        }
    )

    async with httpx.AsyncClient(transport=transport) as client:
        account = await linkedin._fetch_userinfo(client, access_token="tok-123")

    assert account.provider_user_id == "li-user-1"
    assert account.email == "jane@example.com"
    assert account.email_verified is True
    assert account.full_name == "Jane Doe"
    assert account.avatar_url == "https://example.com/jane.jpg"


async def test_fetch_userinfo_rejects_a_non_200_response() -> None:
    transport = _mock_transport(userinfo_status=401)

    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(UnauthorizedError):
            await linkedin._fetch_userinfo(client, access_token="bad-token")


async def test_get_linkedin_account_chains_both_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    transport = _mock_transport(
        token_response={"access_token": "tok-123"},
        userinfo_response={
            "sub": "li-user-1",
            "email": "jane@example.com",
            "email_verified": False,
            "name": "Jane Doe",
            "picture": None,
        },
    )

    class _MockedClient(httpx.AsyncClient):
        def __init__(self, *args, **kwargs) -> None:
            kwargs["transport"] = transport
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(linkedin.httpx, "AsyncClient", _MockedClient)

    account = await linkedin.get_linkedin_account(code="the-code")

    assert account.provider_user_id == "li-user-1"
    assert account.email_verified is False
