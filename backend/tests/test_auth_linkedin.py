"""End-to-end tests for LinkedIn sign-in (#25): GET /auth/linkedin/authorize
and GET /auth/linkedin/callback, exercised the same way every other auth
behaviour in this codebase is tested - through the HTTP layer, against the
real (test) database. LinkedIn itself is mocked at get_linkedin_account -
the one seam between our code and the outside world.
"""

from urllib.parse import parse_qs, urlparse

import pytest
from httpx import AsyncClient

from app.modules.auth import linkedin as linkedin_module
from app.modules.auth.linkedin import LinkedInAccount
from config import get_settings

AUTHORIZE_URL = "/api/v1/auth/linkedin/authorize"
CALLBACK_URL = "/api/v1/auth/linkedin/callback"
REGISTER_URL = "/api/v1/auth/register"
ME_URL = "/api/v1/auth/me"


def _account(
    *,
    provider_user_id: str = "li-1",
    email: str | None = "jane@example.com",
    email_verified: bool = True,
    full_name: str = "Jane Doe",
    avatar_url: str | None = "https://example.com/jane.jpg",
) -> LinkedInAccount:
    return LinkedInAccount(
        provider_user_id=provider_user_id,
        email=email,
        email_verified=email_verified,
        full_name=full_name,
        avatar_url=avatar_url,
    )


def _patch_account(monkeypatch: pytest.MonkeyPatch, account: LinkedInAccount | Exception) -> None:
    async def _fake(*, code: str, code_verifier: str) -> LinkedInAccount:
        if isinstance(account, Exception):
            raise account
        return account

    monkeypatch.setattr(linkedin_module, "get_linkedin_account", _fake)


async def _authorize(client: AsyncClient) -> str:
    """Runs the authorize step and returns the state value the browser would
    hold as a cookie for the callback that follows."""
    response = await client.get(AUTHORIZE_URL)
    assert response.status_code == 200
    return response.cookies["li_oauth_state"]


def _tokens_from_redirect(location: str) -> dict[str, str]:
    fragment = urlparse(location).fragment
    parsed = parse_qs(fragment)
    return {key: values[0] for key, values in parsed.items()}


async def test_authorize_returns_a_consent_url_and_sets_the_state_cookie(
    client: AsyncClient,
) -> None:
    response = await client.get(AUTHORIZE_URL)

    assert response.status_code == 200
    authorize_url = response.json()["authorize_url"]
    assert authorize_url.startswith("https://www.linkedin.com/oauth/v2/authorization?")
    assert "code_challenge=" in authorize_url
    assert response.cookies.get("li_oauth_state") is not None


async def test_callback_creates_a_new_user_and_identity(
    client: AsyncClient, clean_users_table: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    state = await _authorize(client)
    _patch_account(monkeypatch, _account())

    response = await client.get(
        CALLBACK_URL, params={"code": "the-code", "state": state}, follow_redirects=False
    )

    assert response.status_code in (302, 307)
    location = response.headers["location"]
    assert location.startswith(f"{get_settings().frontend_url}/auth/linkedin/callback#")
    tokens = _tokens_from_redirect(location)
    assert "access_token" in tokens
    assert "refresh_token" in tokens

    me = await client.get(ME_URL, headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == "jane@example.com"
    assert body["full_name"] == "Jane Doe"
    assert body["avatar_url"] == "https://example.com/jane.jpg"
    assert body["role"] is None


async def test_callback_logs_in_a_returning_identity_without_duplicating_the_user(
    client: AsyncClient, clean_users_table: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    account = _account(provider_user_id="li-returning")
    _patch_account(monkeypatch, account)

    first_state = await _authorize(client)
    first = await client.get(
        CALLBACK_URL, params={"code": "code-1", "state": first_state}, follow_redirects=False
    )
    first_user_id = (
        await client.get(
            ME_URL,
            headers={
                "Authorization": f"Bearer {_tokens_from_redirect(first.headers['location'])['access_token']}"
            },
        )
    ).json()["id"]

    second_state = await _authorize(client)
    second = await client.get(
        CALLBACK_URL, params={"code": "code-2", "state": second_state}, follow_redirects=False
    )
    second_user_id = (
        await client.get(
            ME_URL,
            headers={
                "Authorization": f"Bearer {_tokens_from_redirect(second.headers['location'])['access_token']}"
            },
        )
    ).json()["id"]

    assert first_user_id == second_user_id


async def test_callback_links_a_verified_email_to_an_existing_account(
    client: AsyncClient, clean_users_table: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    await client.post(
        REGISTER_URL,
        json={
            "email": "jane@example.com",
            "password": "secret123",
            "full_name": "Jane Doe",
            "role": "candidate",
        },
    )

    state = await _authorize(client)
    _patch_account(monkeypatch, _account(email="jane@example.com", email_verified=True))

    response = await client.get(
        CALLBACK_URL, params={"code": "the-code", "state": state}, follow_redirects=False
    )

    assert response.status_code in (302, 307)
    tokens = _tokens_from_redirect(response.headers["location"])
    me = await client.get(ME_URL, headers={"Authorization": f"Bearer {tokens['access_token']}"})
    body = me.json()
    assert body["email"] == "jane@example.com"
    assert body["full_name"] == "Jane Doe"  # the password-registered name, untouched
    assert body["role"] == "candidate"  # the existing account's role, untouched


async def test_callback_refuses_to_link_an_unverified_email(
    client: AsyncClient, clean_users_table: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    await client.post(
        REGISTER_URL,
        json={
            "email": "jane@example.com",
            "password": "secret123",
            "full_name": "Jane Doe",
            "role": "candidate",
        },
    )

    state = await _authorize(client)
    _patch_account(monkeypatch, _account(email="jane@example.com", email_verified=False))

    response = await client.get(
        CALLBACK_URL, params={"code": "the-code", "state": state}, follow_redirects=False
    )

    assert response.status_code in (302, 307)
    location = response.headers["location"]
    assert location.startswith(f"{get_settings().frontend_url}/login?linkedin_error=")
    assert "fragment" not in location
    assert "#" not in location  # no tokens were issued


async def test_callback_rejects_a_mismatched_state(
    client: AsyncClient, clean_users_table: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _authorize(client)  # sets a real cookie, but we deliberately send a different state
    _patch_account(monkeypatch, _account())

    response = await client.get(
        CALLBACK_URL,
        params={"code": "the-code", "state": "not-the-cookie-value"},
        follow_redirects=False,
    )

    assert response.status_code in (302, 307)
    location = response.headers["location"]
    assert location.startswith(f"{get_settings().frontend_url}/login?linkedin_error=")


async def test_callback_rejects_a_missing_state_cookie(
    client: AsyncClient, clean_users_table: None
) -> None:
    """No prior call to /authorize - the browser never received the cookie,
    the way it wouldn't for a forged callback link."""
    response = await client.get(
        CALLBACK_URL, params={"code": "the-code", "state": "anything"}, follow_redirects=False
    )

    assert response.status_code in (302, 307)
    assert response.headers["location"].startswith(
        f"{get_settings().frontend_url}/login?linkedin_error="
    )


async def test_callback_rejects_a_bad_code(
    client: AsyncClient, clean_users_table: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core.exceptions import UnauthorizedError

    state = await _authorize(client)
    _patch_account(monkeypatch, UnauthorizedError("Could not sign in with LinkedIn"))

    response = await client.get(
        CALLBACK_URL, params={"code": "bad-code", "state": state}, follow_redirects=False
    )

    assert response.status_code in (302, 307)
    assert response.headers["location"].startswith(
        f"{get_settings().frontend_url}/login?linkedin_error="
    )
