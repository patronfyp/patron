"""LinkedIn OAuth (#25) - PKCE and CSRF-state helpers.

Kept separate from app/core/security.py: that module signs tokens for an
already-identified user (the `sub` claim is a user id). The state token here
exists before we know who the user is - it just needs to survive the round
trip to LinkedIn and back, so it gets its own small, self-contained helpers
instead of overloading the session-token functions with a second shape.
"""

import base64
import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import jwt

from config import get_settings

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
_SCOPES = "openid profile email"


def generate_pkce_pair() -> tuple[str, str]:
    """Return (code_verifier, code_challenge) for the S256 PKCE method.

    The verifier is the secret half - kept server-side in the state token,
    never sent to LinkedIn until the callback's token exchange. The challenge
    is its SHA-256 hash, sent up front, so a stolen authorization code is
    useless to anyone who didn't generate the matching verifier.
    """
    code_verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return code_verifier, code_challenge


def create_state_token(code_verifier: str) -> str:
    """Bundle the PKCE verifier into a signed, short-lived token.

    This same string is sent to LinkedIn as `state` *and* stored in the
    `li_oauth_state` cookie - both trips end at decode_state_token, which
    checks they still match.
    """
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "code_verifier": code_verifier,
        "iat": now,
        "exp": now + STATE_TOKEN_TTL,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=_JWT_ALGORITHM)


def decode_state_token(token: str) -> dict[str, Any]:
    """Verify and unpack a state token. Raises jwt.PyJWTError if it's
    expired or has been tampered with.

    This alone is not the CSRF check - a stolen token would still decode
    fine. The router compares this value against the `li_oauth_state`
    cookie *before* calling this; only a browser that received our own
    Set-Cookie can present a matching pair, which is what stops an attacker
    from handing a victim a link carrying the attacker's own valid state.
    """
    settings = get_settings()
    return jwt.decode(token, settings.secret_key, algorithms=[_JWT_ALGORITHM])


def build_authorize_url(*, state: str, code_challenge: str) -> str:
    """The URL the frontend redirects the browser to for LinkedIn consent."""
    settings = get_settings()
    params = {
        "response_type": "code",
        "client_id": settings.linkedin_client_id,
        "redirect_uri": settings.linkedin_redirect_uri,
        "scope": _SCOPES,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return f"{_AUTHORIZE_URL}?{urlencode(params)}"
