"""Business rules for the auth module.

Routes call these functions and nothing else - no SQL and no HTTP status codes
belong here, only decisions. STANDARDS.md §2.3.
"""

import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import (
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

from . import repository
from .linkedin import LinkedInAccount
from .models import AuthProvider, User
from .schemas import AccessTokenResponse, RegisterRequest, TokenPair

# Same message for every login failure - see STANDARDS.md §6, rule 10.
# Confirming *which* part was wrong tells an attacker whether an account
# exists for a given email.
_INVALID_CREDENTIALS = "Invalid email or password"


async def register_user(session: AsyncSession, payload: RegisterRequest) -> User:
    """Create a new account from an email + password.

    This is the fallback sign-up path (Module 1.2) - LinkedIn (Module 1.1,
    Sprint 2) will call create_user directly with no password and a
    user_identities row of its own; the duplicate-email rule here is specific
    to this path.
    """
    # RegisterRequest.email is a Pydantic EmailStr, not yet normalised - the
    # lowercasing happens on the User model (see models.py), but the
    # duplicate check has to compare against the same normalised form or a
    # differently-cased duplicate would slip through.
    normalised_email = payload.email.strip().lower()

    existing = await repository.get_by_email(session, normalised_email)
    if existing is not None:
        raise ConflictError("An account with this email already exists")

    password_hash = hash_password(payload.password)
    return await repository.create_user(session, payload, password_hash)


def create_session(user: User) -> TokenPair:
    """Issue a fresh access + refresh token pair for an already-authenticated
    user.

    Deliberately takes just a `User`, not credentials - this is what LinkedIn
    sign-in (#25) will call too, once a user has been found or created via a
    provider identity rather than a password. Nothing here assumes a password
    was involved.
    """
    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


async def authenticate_user(session: AsyncSession, email: str, password: str) -> User:
    """Verify credentials and return the matching user, or raise.

    A user with no password set (a future LinkedIn-only account, Module 1.1)
    fails this the same way a wrong password does - `verify_password` never
    runs, and either way the caller gets a plain 401, not a crash or a hint
    about which case applies.
    """
    user = await repository.get_by_email(session, email.strip().lower())

    if user is None or user.password is None or not verify_password(password, user.password):
        raise UnauthorizedError(_INVALID_CREDENTIALS)

    return user


async def login_with_linkedin(session: AsyncSession, account: LinkedInAccount) -> User:
    """The account-linking rule (#25, ADR - account-linking).

        identity exists for (linkedin, sub)? -> yes -> log in
        no -> user exists with this email?
            no  -> create user + identity, log in
            yes -> LinkedIn reported email_verified?
                yes -> attach identity to that user, log in
                no  -> refuse

    The refusal case matters: trusting an unverified provider email would let
    anyone create a LinkedIn account claiming a victim's address and take
    over their existing Patron account.
    """
    identity = await repository.get_identity(
        session, AuthProvider.LINKEDIN.value, account.provider_user_id
    )
    if identity is not None:
        await repository.touch_identity_login(session, identity)
        return identity.user

    if not account.email:
        raise UnauthorizedError("LinkedIn did not provide an email address for this account")

    normalised_email = account.email.strip().lower()
    existing_user = await repository.get_by_email(session, normalised_email)

    if existing_user is None:
        return await repository.create_user_with_identity(
            session,
            email=normalised_email,
            full_name=account.full_name or normalised_email,
            avatar_url=account.avatar_url,
            is_email_verified=account.email_verified,
            provider=AuthProvider.LINKEDIN.value,
            provider_user_id=account.provider_user_id,
            provider_email=account.email,
        )

    if not account.email_verified:
        raise ConflictError(
            "An account with this email already exists. Sign in with your password instead."
        )

    await repository.attach_identity(
        session,
        existing_user,
        provider=AuthProvider.LINKEDIN.value,
        provider_user_id=account.provider_user_id,
        provider_email=account.email,
    )
    return existing_user


async def set_user_role(session: AsyncSession, user: User, role: str) -> User:
    """POST /auth/role - the step a LinkedIn sign-up needs that email/password
    registration doesn't, since LinkedIn never tells us candidate vs company."""
    return await repository.update_role(session, user, role)


async def refresh_access_token(session: AsyncSession, refresh_token: str) -> AccessTokenResponse:
    """Exchange a valid, unexpired refresh token for a new access token.

    Re-checks the user against the database rather than trusting the token's
    `sub` claim alone - otherwise a banned or deleted account (Module 13.2)
    keeps minting fresh access tokens for as long as its refresh token has
    left to live, up to 7 days.
    """
    try:
        payload = decode_token(refresh_token, expected_type=TokenType.REFRESH)
    except jwt.PyJWTError as exc:
        raise UnauthorizedError("Invalid or expired refresh token") from exc

    user = await repository.get_by_id(session, int(payload["sub"]))
    if user is None or not user.is_active:
        raise UnauthorizedError("Invalid or expired refresh token")

    return AccessTokenResponse(access_token=create_access_token(user.id))
