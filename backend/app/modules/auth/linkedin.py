"""LinkedIn OAuth: the CSRF state token and the LinkedIn API client.

No PKCE - LinkedIn's self-serve product rejects it (ADRs 0013, 0014).
"""

import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt

from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError

_GENERIC_FAILURE = "Could not sign in with LinkedIn"

logger = logging.getLogger(__name__)

_JWT_ALGORITHM = "HS256"

# Time to finish LinkedIn's consent screen.
STATE_TOKEN_TTL = timedelta(minutes=5)

# Set by /authorize, compared with LinkedIn's `state` on /callback.
STATE_COOKIE_NAME = "li_oauth_state"

_AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization"
_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"  # noqa: S105 -- a URL, not a secret
_USERINFO_URL = "https://api.linkedin.com/v2/userinfo"
_SCOPES = "openid profile email"
_REQUEST_TIMEOUT = 10.0


def create_state_token() -> str:
    """A signed, short-lived random token - sent as `state` and kept in the cookie."""
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "nonce": secrets.token_urlsafe(16),
        "iat": now,
        "exp": now + STATE_TOKEN_TTL,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=_JWT_ALGORITHM)


def decode_state_token(token: str) -> dict[str, Any]:
    """Verify a state token; raises jwt.PyJWTError if expired or tampered.

    Not the CSRF check by itself - the router first matches it to the cookie.
    """
    settings = get_settings()
    return jwt.decode(token, settings.secret_key, algorithms=[_JWT_ALGORITHM])


def build_authorize_url(*, state: str) -> str:
    """The URL the frontend redirects the browser to for LinkedIn consent."""
    settings = get_settings()
    params = {
        "response_type": "code",
        "client_id": settings.linkedin_client_id,
        "redirect_uri": settings.linkedin_redirect_uri,
        "scope": _SCOPES,
        "state": state,
    }
    return f"{_AUTHORIZE_URL}?{urlencode(params)}"


@dataclass
class LinkedInAccount:
    """What we keep from LinkedIn's profile, under our own field names."""

    provider_user_id: str
    email: str | None
    email_verified: bool
    full_name: str
    avatar_url: str | None


async def _exchange_code_for_access_token(client: httpx.AsyncClient, *, code: str) -> str:
    """Trade the code for LinkedIn's access token - used once, never stored."""
    settings = get_settings()
    response = await client.post(
        _TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.linkedin_redirect_uri,
            "client_id": settings.linkedin_client_id,
            "client_secret": settings.linkedin_client_secret,
        },
    )
    if response.status_code != httpx.codes.OK:
        logger.warning(
            "LinkedIn token exchange failed: status=%s body=%s",
            response.status_code,
            response.text,
        )
        raise UnauthorizedError(_GENERIC_FAILURE)

    access_token = response.json().get("access_token")
    if not access_token:
        logger.warning("LinkedIn token response had no access_token: body=%s", response.text)
        raise UnauthorizedError(_GENERIC_FAILURE)
    return access_token


async def _fetch_userinfo(client: httpx.AsyncClient, *, access_token: str) -> LinkedInAccount:
    response = await client.get(
        _USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
    )
    if response.status_code != httpx.codes.OK:
        logger.warning(
            "LinkedIn userinfo request failed: status=%s body=%s",
            response.status_code,
            response.text,
        )
        raise UnauthorizedError(_GENERIC_FAILURE)

    data = response.json()
    provider_user_id = data.get("sub")
    if not provider_user_id:
        logger.warning("LinkedIn userinfo response had no sub claim: body=%s", response.text)
        raise UnauthorizedError(_GENERIC_FAILURE)

    return LinkedInAccount(
        provider_user_id=provider_user_id,
        email=data.get("email"),
        email_verified=bool(data.get("email_verified", False)),
        full_name=data.get("name", ""),
        avatar_url=data.get("picture"),
    )


async def get_linkedin_account(*, code: str) -> LinkedInAccount:
    """Authorization code -> LinkedIn profile, in one call."""
    async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
        access_token = await _exchange_code_for_access_token(client, code=code)
        return await _fetch_userinfo(client, access_token=access_token)
