"""Business rules for sign-up, sign-in, sessions and passwords."""

import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.email import EmailDeliveryError, EmailSender
from app.core.exceptions import BadRequestError, ConflictError, UnauthorizedError
from app.core.security import (
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    issued_before,
    token_user_id,
    verify_password,
)

from . import repository
from .linkedin import LinkedInAccount
from .models import AuthProvider, User
from .schemas import AccessTokenResponse, RegisterRequest, TokenPair

logger = logging.getLogger(__name__)

# One message for every login failure, so it never reveals which emails exist.
_INVALID_CREDENTIALS = "Invalid email or password"


async def register_user(session: AsyncSession, payload: RegisterRequest) -> User:
    """Create an account from email + password (Module 1.2). 409 if taken."""
    # Lowercased here too, so the duplicate check matches what the model stores.
    normalised_email = payload.email.strip().lower()

    existing = await repository.get_by_email(session, normalised_email)
    if existing is not None:
        raise ConflictError("An account with this email already exists")

    password_hash = hash_password(payload.password)
    return await repository.create_user(session, payload, password_hash)


def create_session(user: User) -> TokenPair:
    """A fresh token pair for a user already authenticated - by password or LinkedIn."""
    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


async def authenticate_user(session: AsyncSession, email: str, password: str) -> User:
    """The user for these credentials, or 401. A LinkedIn-only user fails the same way."""
    user = await repository.get_by_email(session, email.strip().lower())

    if user is None or user.password is None or not verify_password(password, user.password):
        raise UnauthorizedError(_INVALID_CREDENTIALS)

    return user


async def login_with_linkedin(session: AsyncSession, account: LinkedInAccount) -> User:
    """Find, link or create the user for a LinkedIn sign-in (ADR 0011).

    known LinkedIn id        -> log in
    new email                -> create user + identity
    existing email, verified -> link identity to that user
    existing email, not      -> refuse (else anyone could take over the account)
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


async def add_user_role(session: AsyncSession, user: User, role: str) -> User:
    """Add a role (a LinkedIn sign-up's first one). Already held is a no-op."""
    if role in user.roles:
        return user
    return await repository.add_role(session, user, role)


async def refresh_access_token(session: AsyncSession, refresh_token: str) -> AccessTokenResponse:
    """A new access token for a valid refresh token.

    Re-checks the user, so a banned account can't keep minting tokens.
    """
    try:
        payload = decode_token(refresh_token, expected_type=TokenType.REFRESH)
        user_id = token_user_id(payload)
    except jwt.PyJWTError as exc:
        raise UnauthorizedError("Invalid or expired refresh token") from exc

    user = await repository.get_by_id(session, user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Invalid or expired refresh token")
    # Tokens aren't stored, so a password change revokes them by date.
    if issued_before(payload, user.password_changed_at):
        raise UnauthorizedError("Invalid or expired refresh token")

    return AccessTokenResponse(access_token=create_access_token(user.id))


# --- Password change - Module 1.8 -------------------------------------------


async def change_password(
    session: AsyncSession, user: User, current_password: str, new_password: str
) -> TokenPair:
    """Change the password, sign out every other session, return new tokens.

    A wrong current password is 400, not 401 - a 401 would trigger a token refresh.
    """
    if user.password is None:
        raise BadRequestError(
            "Your account doesn't have a password yet. Use 'Forgot password' to set one."
        )
    if not verify_password(current_password, user.password):
        raise BadRequestError("Your current password is incorrect.")
    if verify_password(new_password, user.password):
        raise BadRequestError("Choose a new password that's different from your current one.")

    await repository.set_password(session, user, hash_password(new_password), datetime.now(UTC))
    return create_session(user)


# --- Password reset - Module 1.12 -------------------------------------------

RESET_TOKEN_TTL = timedelta(minutes=30)
# One link per minute per account, so the form can't flood an inbox.
RESET_REQUEST_COOLDOWN = timedelta(seconds=60)

_INVALID_RESET_TOKEN = "This reset link is invalid or has expired. Request a new one."  # noqa: S105 -- a user-facing message, not a secret


def _hash_reset_token(token: str) -> str:
    """Plain SHA-256 is enough: the token is 256 random bits."""
    return hashlib.sha256(token.encode()).hexdigest()


async def request_password_reset(session: AsyncSession, email: str, sender: EmailSender) -> None:
    """Email a reset link if an active account has this address.

    Never raises - any error would reveal whether the account exists.
    """
    user = await repository.get_by_email(session, email.strip().lower())
    if user is None or not user.is_active:
        return

    now = datetime.now(UTC)
    latest = await repository.get_latest_reset_token(session, user.id)
    if latest is not None and now - latest.created_at < RESET_REQUEST_COOLDOWN:
        return

    # A new link replaces any earlier one still waiting to be used.
    await repository.expire_unused_reset_tokens(session, user.id, now)
    token = secrets.token_urlsafe(32)
    row = await repository.create_reset_token(
        session, user.id, _hash_reset_token(token), now + RESET_TOKEN_TTL
    )

    link = f"{get_settings().frontend_url}/reset-password?token={token}"
    minutes = int(RESET_TOKEN_TTL.total_seconds() // 60)
    try:
        await sender.send(
            to=user.email,
            subject="Reset your PATRON password",
            body=(
                f"Someone asked to reset the password for your PATRON account.\n\n"
                f"Open this link to choose a new one (it expires in {minutes} minutes):\n"
                f"{link}\n\n"
                f"If it wasn't you, ignore this email - your password stays the same."
            ),
        )
    except EmailDeliveryError:
        # Undelivered - drop it so the cooldown doesn't block a retry.
        logger.exception("Password reset email could not be sent for user %s", user.id)
        await repository.delete_reset_token(session, row)


async def confirm_password_reset(session: AsyncSession, token: str, new_password: str) -> None:
    """Set a new password from a reset link and sign out everywhere.

    Every bad token is the same 400. Also lets a LinkedIn-only user set a password.
    """
    row = await repository.get_reset_token_by_hash(session, _hash_reset_token(token))
    now = datetime.now(UTC)
    if row is None or row.used_at is not None or row.expires_at <= now:
        raise BadRequestError(_INVALID_RESET_TOKEN)

    user = await repository.get_by_id(session, row.user_id)
    if user is None or not user.is_active:
        raise BadRequestError(_INVALID_RESET_TOKEN)

    await repository.reset_password(session, user, row, hash_password(new_password), now)
