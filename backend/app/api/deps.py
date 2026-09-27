"""Shared FastAPI dependencies. `get_current_user` is the one every protected
endpoint in every module will use - see STANDARDS.md.
"""

from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnauthorizedError
from app.core.security import TokenType, decode_token
from app.modules.auth import repository
from app.modules.auth.models import User
from db import get_session

_INVALID_CREDENTIALS = "Could not validate credentials"

# auto_error=False: FastAPI's own HTTPBearer raises 403 on a missing header,
# which the acceptance criteria for this issue explicitly rules out (missing
# header must be 401). Checking for None ourselves and raising through our own
# AppError hierarchy keeps every auth failure the same {"detail", "code"}
# shape, regardless of which of the four ways it failed.
_bearer_scheme = HTTPBearer(auto_error=False)

SessionDep = Annotated[AsyncSession, Depends(get_session)]
CredentialsDep = Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)]


async def get_current_user(credentials: CredentialsDep, session: SessionDep) -> User:
    """Require a valid access token and return the signed-in User.

    Used as `current_user: CurrentUser` (below) in any endpoint that needs
    auth. Every protected route in every module goes through this one
    function, so all four ways of being unauthenticated - no header, a
    malformed or expired token, or a token for a user who has since been
    deleted or deactivated (Module 13.2) - end up as the same 401.
    """
    if credentials is None:
        raise UnauthorizedError(_INVALID_CREDENTIALS)

    try:
        payload = decode_token(credentials.credentials, expected_type=TokenType.ACCESS)
    except jwt.PyJWTError as exc:
        raise UnauthorizedError(_INVALID_CREDENTIALS) from exc

    user = await repository.get_by_id(session, int(payload["sub"]))
    if user is None or not user.is_active:
        raise UnauthorizedError(_INVALID_CREDENTIALS)

    return user


# The type every other module's routes should use:
#   async def some_protected_route(current_user: CurrentUser): ...
CurrentUser = Annotated[User, Depends(get_current_user)]
