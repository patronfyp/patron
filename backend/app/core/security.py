"""Password hashing.

Nothing else touches bcrypt directly - every code path that needs to hash or
check a password goes through these two functions, so the algorithm can be
changed in one place later if needed.

We use the `bcrypt` library directly rather than passlib. passlib's bcrypt
wrapper has been broken since bcrypt 4.1 (it probes `bcrypt.__about__`, which
that release removed) and passlib itself has had no release since 2020 - so
"the standard way to do this in Python" is no longer a safe assumption to
build on. Direct use of `bcrypt` is what current guidance recommends instead.
"""

from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any

import bcrypt
import jwt

from config import get_settings

# bcrypt silently truncates any input past 72 bytes - a password entered past
# that point would be ignored rather than rejected, which is worse than just
# refusing it. Enforced in RegisterRequest (schemas.py) as `max_length=72` on
# the ASCII case; comfortably above what any real password needs.
_BCRYPT_MAX_BYTES = 72

_JWT_ALGORITHM = "HS256"


def hash_password(plain_password: str) -> str:
    """Hash a password for storage. Never store or log the plain value."""
    password_bytes = plain_password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a plain password against a stored hash."""
    password_bytes = plain_password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    return bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))


class TokenType(StrEnum):
    """The `type` claim inside our JWTs.

    Both token kinds are signed with the same secret and would otherwise be
    interchangeable, which would let a stolen access token (short-lived, but
    handled by far more code paths) be replayed against /auth/refresh to mint
    fresh access tokens indefinitely. Checking this claim is what stops that.
    """

    ACCESS = "access"
    REFRESH = "refresh"


def _create_token(user_id: int, token_type: TokenType, expires_delta: timedelta) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),  # JWT spec requires `sub` to be a string
        "type": token_type.value,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=_JWT_ALGORITHM)


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    delta = timedelta(minutes=settings.access_token_expire_minutes)
    return _create_token(user_id, TokenType.ACCESS, delta)


def create_refresh_token(user_id: int) -> str:
    settings = get_settings()
    delta = timedelta(days=settings.refresh_token_expire_days)
    return _create_token(user_id, TokenType.REFRESH, delta)


def decode_token(token: str, *, expected_type: TokenType) -> dict[str, Any]:
    """Decode and validate a token, including that it is the expected kind.

    Raises `jwt.PyJWTError` (or a subclass) on anything wrong - expired,
    tampered signature, or wrong token type. Callers turn that into a 401;
    nothing here talks HTTP.
    """
    settings = get_settings()
    payload = jwt.decode(token, settings.secret_key, algorithms=[_JWT_ALGORITHM])
    if payload.get("type") != expected_type.value:
        raise jwt.InvalidTokenError(f"Expected a {expected_type.value} token")
    return payload


def issued_before(payload: dict[str, Any], moment: datetime | None) -> bool:
    """True if a decoded token was issued before `moment`.

    Used to revoke every token from before a password reset (Module 1.12).
    `iat` is stored in whole seconds, so `moment` is floored to the second
    too - otherwise a token issued in the same second as the reset, i.e. the
    user's fresh login right after it, would be refused.
    """
    if moment is None:
        return False
    return int(payload["iat"]) < int(moment.timestamp())
