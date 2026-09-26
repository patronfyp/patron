"""Business rules for the auth module.

Routes call these functions and nothing else - no SQL and no HTTP status codes
belong here, only decisions. STANDARDS.md §2.3.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError
from app.core.security import hash_password

from . import repository
from .models import User
from .schemas import RegisterRequest


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
