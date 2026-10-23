"""Password hashing and JWTs - the only place bcrypt and jwt are used.

`bcrypt` directly, not passlib: passlib is unmaintained and broken on bcrypt 4.1+.
"""

import uuid
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any

import bcrypt
import jwt

from app.core.config import get_settings

# bcrypt ignores bytes past 72; the schemas reject longer passwords instead.
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
    """The JWT `type` claim - stops an access token being used as a refresh token."""

    ACCESS = "access"
    REFRESH = "refresh"


def _create_token(user_id: uuid.UUID, token_type: TokenType, expires_delta: timedelta) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),  # JWT spec requires `sub` to be a string
        "type": token_type.value,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=_JWT_ALGORITHM)


def create_access_token(user_id: uuid.UUID) -> str:
    settings = get_settings()
    delta = timedelta(minutes=settings.access_token_expire_minutes)
    return _create_token(user_id, TokenType.ACCESS, delta)


def create_refresh_token(user_id: uuid.UUID) -> str:
    settings = get_settings()
    delta = timedelta(days=settings.refresh_token_expire_days)
    return _create_token(user_id, TokenType.REFRESH, delta)


def decode_token(token: str, *, expected_type: TokenType) -> dict[str, Any]:
    """Decode a token of the expected type; raises `jwt.PyJWTError` if anything's wrong."""
    settings = get_settings()
    payload = jwt.decode(token, settings.secret_key, algorithms=[_JWT_ALGORITHM])
    if payload.get("type") != expected_type.value:
        raise jwt.InvalidTokenError(f"Expected a {expected_type.value} token")
    return payload


def token_user_id(payload: dict[str, Any]) -> uuid.UUID:
    """The user id in `sub`. A non-UUID (an old token) raises, so it becomes a 401."""
    try:
        return uuid.UUID(payload["sub"])
    except (KeyError, TypeError, ValueError) as exc:
        raise jwt.InvalidTokenError("Token subject is not a user id") from exc


def issued_before(payload: dict[str, Any], moment: datetime | None) -> bool:
    """True if the token predates `moment` (a password change, Module 1.12).

    Compared in whole seconds, like `iat`, so a login in the same second still works.
    """
    if moment is None:
        return False
    return int(payload["iat"]) < int(moment.timestamp())
