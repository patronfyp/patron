"""LinkedIn OAuth (#25) - CSRF-state helpers and the LinkedIn API client.

No PKCE here - see ADR 0014. LinkedIn's "Sign In with LinkedIn using OpenID
Connect" product (the one this project can self-serve, ADR 0013) rejects a
token exchange that includes code_verifier: the token endpoint returns
invalid_client/"Client authentication failed", which is LinkedIn's generic
auth-failure error, not a PKCE-specific one - this took directly testing
against the real endpoint to find, since nothing says so in LinkedIn's docs.

Kept separate from app/core/security.py: that module signs tokens for an
already-identified user (the `sub` claim is a user id). The state token here
exists before we know who the user is - it just needs to survive the round
trip to LinkedIn and back, so it gets its own small, self-contained helpers
instead of overloading the session-token functions with a second shape.
"""

import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt

from app.core.exceptions import UnauthorizedError
from config import get_settings

_GENERIC_FAILURE = "Could not sign in with LinkedIn"

logger = logging.getLogger(__name__)

_JWT_ALGORITHM = "HS256"

# How long a user has to complete the LinkedIn consent screen before the
# state token (and the cookie holding it) expire. Five minutes is generous
# for "click a button, approve on LinkedIn" and short enough that a leaked
# state token is useless soon after.
STATE_TOKEN_TTL = timedelta(minutes=5)

# Name of the httpOnly cookie set by /authorize and read by /callback. Its
# value is compared against the `state` query param LinkedIn echoes back -
# see decode_state_token's docstring for why that comparison is the actual
# CSRF defence, not the token's signature alone.
STATE_COOKIE_NAME = "li_oauth_state"

_AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization"
_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"  # noqa: S105 -- a URL, not a secret
_USERINFO_URL = "https://api.linkedin.com/v2/userinfo"
_SCOPES = "openid profile email"
_REQUEST_TIMEOUT = 10.0


def create_state_token() -> str:
    """A signed, short-lived, single-use-in-spirit token with no meaningful
    payload of its own - its value just needs to be unguessable and provably
    ours. This same string is sent to LinkedIn as `state` *and* stored in the
    `li_oauth_state` cookie - both trips end at decode_state_token, which
    checks they still match.
    """
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "nonce": secrets.token_urlsafe(16),
        "iat": now,
        "exp": now + STATE_TOKEN_TTL,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=_JWT_ALGORITHM)


def decode_state_token(token: str) -> dict[str, Any]:
    """Verify a state token. Raises jwt.PyJWTError if it's expired or has
    been tampered with.

    This alone is not the CSRF check - a stolen token would still decode
    fine. The router compares this value against the `li_oauth_state`
    cookie *before* calling this; only a browser that received our own
    Set-Cookie can present a matching pair, which is what stops an attacker
    from handing a victim a link carrying the attacker's own valid state.
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
    """What we keep from LinkedIn's userinfo response - our own field names,
    not LinkedIn's raw OpenID Connect claim names, so nothing downstream
    depends on LinkedIn's wire shape."""

    provider_user_id: str
    email: str | None
    email_verified: bool
    full_name: str
    avatar_url: str | None


async def _exchange_code_for_access_token(client: httpx.AsyncClient, *, code: str) -> str:
    """POST the authorization code, get LinkedIn's own access token back.
    That token is used once, right below, to fetch the profile - it is
    never stored (see ADR 0013: acceptance criteria say LinkedIn's tokens
    are used once and discarded). No PKCE - see ADR 0014."""
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
    """The whole exchange in one call: authorization code -> LinkedIn access
    token -> the profile fields we care about. What service.py calls; it
    never needs to know an intermediate access token existed at all."""
    async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
        access_token = await _exchange_code_for_access_token(client, code=code)
        return await _fetch_userinfo(client, access_token=access_token)
