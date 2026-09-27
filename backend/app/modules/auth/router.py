"""HTTP layer for the auth module. URL, validation, response shape - no
business logic and no queries. STANDARDS.md §2.3."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session

from . import service
from .schemas import (
    AccessTokenResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UserRead,
)

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


@router.post(
    "/login",
    response_model=TokenPair,
    summary="Log in with email and password",
    responses={
        401: {"description": "Invalid email or password"},
    },
)
async def login(payload: LoginRequest, session: SessionDep) -> TokenPair:
    """Exchange an email and password for an access token and a refresh token.

    Wrong password and unknown email return the identical 401 message - see
    STANDARDS.md §6, rule 10.
    """
    user = await service.authenticate_user(session, payload.email, payload.password)
    return service.create_session(user)


@router.post(
    "/refresh",
    response_model=AccessTokenResponse,
    summary="Exchange a refresh token for a new access token",
    responses={
        401: {"description": "Invalid or expired refresh token"},
    },
)
async def refresh(payload: RefreshRequest, session: SessionDep) -> AccessTokenResponse:
    """Get a new access token without asking the user to log in again.

    The access token in `TokenPair` expires quickly on purpose (Module 1.13) -
    this is how the client stays signed in past that without holding
    long-lived credentials.
    """
    return await service.refresh_access_token(session, payload.refresh_token)
