"""Request/response shapes for the auth module.

Separate Create/Read schemas, always - STANDARDS.md §3.4. A client must never
be able to set fields like `id` or `is_verified`, and a response must never be
able to leak `password`. Returning the ORM model directly is the single most
common way projects leak a password hash.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .models import UserRole


class RegisterRequest(BaseModel):
    """What a client sends to POST /api/v1/auth/register."""

    email: EmailStr
    # max_length=72 matches bcrypt's input limit (see app/core/security.py) -
    # rejecting an overlong password here is better than silently truncating it.
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=1, max_length=150)
    role: UserRole

    @field_validator("full_name")
    @classmethod
    def _strip_full_name(cls, value: str) -> str:
        return value.strip()


class LoginRequest(BaseModel):
    """What a client sends to POST /api/v1/auth/login."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class TokenPair(BaseModel):
    """Returned by /login: both tokens for a fresh session."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105 -- the OAuth2 token type literal, not a secret


class RefreshRequest(BaseModel):
    """What a client sends to POST /api/v1/auth/refresh."""

    refresh_token: str


class AccessTokenResponse(BaseModel):
    """Returned by /refresh: a new access token only. The refresh token the
    client already holds keeps working until it expires or is rotated by a
    later change - not reissued here."""

    access_token: str
    token_type: str = "bearer"  # noqa: S105 -- the OAuth2 token type literal, not a secret


class UserRead(BaseModel):
    """What we send back. No password field exists on this schema at all -
    there is nothing here to accidentally leak."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    avatar_url: str | None
    role: str | None
    is_email_verified: bool
    is_active: bool
    created_at: datetime
