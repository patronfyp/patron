"""HTTP layer for the auth module. URL, validation, response shape - no
business logic and no queries. STANDARDS.md §2.3."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session

from . import service
from .schemas import RegisterRequest, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register with email and password",
    responses={
        409: {"description": "An account with this email already exists"},
        422: {"description": "Validation failed - weak password, bad email, or an invalid role"},
    },
)
async def register(payload: RegisterRequest, session: SessionDep) -> UserRead:
    """Create an account with an email address and a password.

    This is the fallback sign-up path (Module 1.2) - LinkedIn OAuth
    (Module 1.1) is the primary route and lands in Sprint 2. The password is
    hashed with bcrypt before storage and is never returned in the response.
    """
    user = await service.register_user(session, payload)
    return UserRead.model_validate(user)
