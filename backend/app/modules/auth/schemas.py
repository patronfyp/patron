"""Request/response shapes for auth. Separate in/out schemas, so a response
can never leak `password` (STANDARDS.md §3.4)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .models import SignupRole, UserRole


class RegisterRequest(BaseModel):
    """What a client sends to POST /api/v1/auth/register."""

    email: EmailStr
    # max_length=72 matches bcrypt's input limit (see app/core/security.py) -
    # rejecting an overlong password here is better than silently truncating it.
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=1, max_length=150)
    # The "I want to" card picked at sign-up. More roles can be added later
    # through POST /auth/role; admin can never be picked (SignupRole).
    role: SignupRole

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


class LinkedInAuthorizeResponse(BaseModel):
    """Returned by GET /auth/linkedin/authorize: the URL the frontend sends
    the browser to for LinkedIn's consent screen."""

    authorize_url: str


class AddRoleRequest(BaseModel):
    """What a client sends to POST /auth/role - a role to add to the account.
    A LinkedIn sign-up uses it for its first role; anyone can use it later to
    take on another one."""

    role: SignupRole


class UserRead(BaseModel):
    """What we send back. No password field exists on this schema at all -
    there is nothing here to accidentally leak."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    avatar_url: str | None
    # Empty only for a LinkedIn sign-up that hasn't picked a role yet.
    roles: list[UserRole]
    is_email_verified: bool
    is_active: bool
    created_at: datetime


class PasswordResetRequest(BaseModel):
    """What a client sends to POST /auth/password-reset/request."""

    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """POST /auth/password-reset/confirm. Same password rules as registration."""

    token: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=8, max_length=72)


class PasswordChangeRequest(BaseModel):
    """POST /auth/password/change. Same password rules as registration."""

    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)


class PasswordResetRequested(BaseModel):
    """Returned by /password-reset/request - the same body every time."""

    detail: str = "If an account uses that email, we've sent a link to reset the password."
