"""Shared FastAPI dependencies. Protected endpoints take `current_user: CurrentUser`."""

from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.exceptions import UnauthorizedError
from app.core.security import TokenType, decode_token, issued_before, token_user_id
from app.modules.auth import repository
from app.modules.auth.models import User

_INVALID_CREDENTIALS = "Could not validate credentials"

# auto_error=False: HTTPBearer would answer a missing header with 403; we want
# the same 401 as every other auth failure.
_bearer_scheme = HTTPBearer(auto_error=False)

SessionDep = Annotated[AsyncSession, Depends(get_session)]
CredentialsDep = Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)]


async def get_current_user(credentials: CredentialsDep, session: SessionDep) -> User:
    """The signed-in user, or 401 for a missing, bad or expired token, or an
    inactive user."""
    if credentials is None:
        raise UnauthorizedError(_INVALID_CREDENTIALS)

    try:
        payload = decode_token(credentials.credentials, expected_type=TokenType.ACCESS)
        user_id = token_user_id(payload)
    except jwt.PyJWTError as exc:
        raise UnauthorizedError(_INVALID_CREDENTIALS) from exc

    user = await repository.get_by_id(session, user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError(_INVALID_CREDENTIALS)
    # A password reset signs out every session that existed before it.
    if issued_before(payload, user.password_changed_at):
        raise UnauthorizedError(_INVALID_CREDENTIALS)

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
