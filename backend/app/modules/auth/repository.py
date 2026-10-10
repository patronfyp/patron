"""Database queries for the auth module. The only place SQL lives.

Functions here just fetch and store rows - no decisions about whether
something is allowed. That belongs in service.py.
"""

from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import PasswordResetToken, User, UserIdentity
from .schemas import RegisterRequest


async def get_by_email(session: AsyncSession, email: str) -> User | None:
    """Look up a user by email. Caller is responsible for lowercasing first -
    though User.email is normalised on assignment regardless, so a query
    against an already-lowercase value is what actually matches."""
    stmt = select(User).where(User.email == email)
    return await session.scalar(stmt)


async def get_by_id(session: AsyncSession, user_id: int) -> User | None:
    return await session.get(User, user_id)


async def create_user(session: AsyncSession, payload: RegisterRequest, password_hash: str) -> User:
    """Insert a new user row. Assumes the duplicate-email check already ran -
    that decision belongs to the service, not here."""
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        role=payload.role.value,
        password=password_hash,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def get_identity(
    session: AsyncSession, provider: str, provider_user_id: str
) -> UserIdentity | None:
    """Look up a provider identity - the only way a returning provider sign-in
    is matched (never by email, which a person can change at the provider)."""
    stmt = (
        select(UserIdentity)
        .where(
            UserIdentity.provider == provider,
            UserIdentity.provider_user_id == provider_user_id,
        )
        .options(selectinload(UserIdentity.user))
    )
    return await session.scalar(stmt)


async def touch_identity_login(session: AsyncSession, identity: UserIdentity) -> None:
    """Record that this identity was just used to sign in."""
    identity.last_login_at = datetime.now(UTC)
    await session.commit()


async def create_user_with_identity(
    session: AsyncSession,
    *,
    email: str,
    full_name: str,
    avatar_url: str | None,
    is_email_verified: bool,
    provider: str,
    provider_user_id: str,
    provider_email: str | None,
) -> User:
    """First-time sign-in through a provider: no password, no role yet - both
    are nullable on User for exactly this case (see models.py)."""
    user = User(
        email=email,
        full_name=full_name,
        avatar_url=avatar_url,
        is_email_verified=is_email_verified,
        role=None,
        password=None,
    )
    session.add(user)
    await session.flush()  # assigns user.id, needed for the identity row below

    identity = UserIdentity(
        user_id=user.id,
        provider=provider,
        provider_user_id=provider_user_id,
        provider_email=provider_email,
    )
    session.add(identity)
    await session.commit()
    await session.refresh(user)
    return user


async def attach_identity(
    session: AsyncSession,
    user: User,
    *,
    provider: str,
    provider_user_id: str,
    provider_email: str | None,
) -> None:
    """Link a new provider identity to an existing account - the verified-
    email-match case in the account-linking rule (service.py)."""
    identity = UserIdentity(
        user_id=user.id,
        provider=provider,
        provider_user_id=provider_user_id,
        provider_email=provider_email,
    )
    session.add(identity)
    await session.commit()


async def update_role(session: AsyncSession, user: User, role: str) -> User:
    """Set a user's role - the one field a LinkedIn sign-up (models.py) starts
    without, asked for once through POST /auth/role."""
    user.role = role
    await session.commit()
    await session.refresh(user)
    return user


async def get_latest_reset_token(session: AsyncSession, user_id: int) -> PasswordResetToken | None:
    """The most recently issued reset link for this user, used or not."""
    stmt = (
        select(PasswordResetToken)
        .where(PasswordResetToken.user_id == user_id)
        .order_by(PasswordResetToken.created_at.desc(), PasswordResetToken.id.desc())
        .limit(1)
    )
    return await session.scalar(stmt)


async def get_reset_token_by_hash(
    session: AsyncSession, token_hash: str
) -> PasswordResetToken | None:
    stmt = select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    return await session.scalar(stmt)


async def expire_unused_reset_tokens(session: AsyncSession, user_id: int, now: datetime) -> None:
    """Mark every still-unused link for this user as used. Does not commit -
    the caller commits it together with the new token."""
    stmt = (
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user_id, PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
    await session.execute(stmt)


async def create_reset_token(
    session: AsyncSession, user_id: int, token_hash: str, expires_at: datetime
) -> PasswordResetToken:
    row = PasswordResetToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def delete_reset_token(session: AsyncSession, row: PasswordResetToken) -> None:
    await session.delete(row)
    await session.commit()


async def reset_password(
    session: AsyncSession, user: User, row: PasswordResetToken, password_hash: str, now: datetime
) -> None:
    """Set the new password, record when it changed, and use up the token -
    in one commit, so a crash can never leave the token reusable after the
    password changed."""
    user.password = password_hash
    user.password_changed_at = now
    row.used_at = now
    await session.commit()
