"""Unit tests for the PKCE/state helpers behind LinkedIn OAuth (#25).

No database or network involved - these are pure functions, tested as such.
The full authorize/callback flow is covered separately once those routes
exist.
"""

import base64
import hashlib
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.modules.auth import linkedin
from config import get_settings


def test_pkce_pair_challenge_matches_verifier() -> None:
    verifier, challenge = linkedin.generate_pkce_pair()

    expected_digest = hashlib.sha256(verifier.encode("ascii")).digest()
    expected_challenge = base64.urlsafe_b64encode(expected_digest).rstrip(b"=").decode("ascii")

    assert challenge == expected_challenge
    # Not required to be unpadded/URL-safe by spec alone, but LinkedIn expects
    # base64url without padding - assert both, not just correctness.
    assert "=" not in challenge
    assert "+" not in challenge and "/" not in challenge


def test_pkce_pairs_are_unique_per_call() -> None:
    verifier_a, _ = linkedin.generate_pkce_pair()
    verifier_b, _ = linkedin.generate_pkce_pair()

    assert verifier_a != verifier_b


def test_state_token_round_trips_the_verifier() -> None:
    verifier, _ = linkedin.generate_pkce_pair()

    token = linkedin.create_state_token(verifier)
    payload = linkedin.decode_state_token(token)

    assert payload["code_verifier"] == verifier


def test_state_token_rejects_tampering() -> None:
    token = linkedin.create_state_token("some-verifier")

    with pytest.raises(jwt.PyJWTError):
        linkedin.decode_state_token(token + "tampered")


def test_state_token_rejects_expiry() -> None:
    settings = get_settings()
    now = datetime.now(UTC)
    expired = jwt.encode(
        {
            "code_verifier": "some-verifier",
            "iat": now - timedelta(minutes=10),
            "exp": now - timedelta(minutes=5),
        },
        settings.secret_key,
        algorithm="HS256",
    )

    with pytest.raises(jwt.PyJWTError):
        linkedin.decode_state_token(expired)


def test_build_authorize_url_carries_pkce_and_state() -> None:
    url = linkedin.build_authorize_url(state="the-state-token", code_challenge="the-challenge")

    assert url.startswith("https://www.linkedin.com/oauth/v2/authorization?")
    assert "state=the-state-token" in url
    assert "code_challenge=the-challenge" in url
    assert "code_challenge_method=S256" in url
    assert "response_type=code" in url
