"""Auth endpoints: register, login, LinkedIn, roles, passwords."""

from typing import Annotated
from urllib.parse import quote

import jwt
from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.config import get_settings
from app.core.database import get_session
from app.core.email import EmailSender, get_email_sender
from app.core.exceptions import AppError

from . import linkedin, service
from .schemas import (
    AccessTokenResponse,
    AddRoleRequest,
    LinkedInAuthorizeResponse,
    LoginRequest,
    PasswordChangeRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetRequested,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UserRead,
)

router = APIRouter(prefix="/auth", tags=["auth"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
SenderDep = Annotated[EmailSender, Depends(get_email_sender)]

# Deliberately vague: the exact reason would only help an attacker.
_STATE_INVALID = "Your sign-in attempt has expired or is invalid. Please try again."


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
    """Create an account with email and password (Module 1.2)."""
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
    """Exchange email and password for an access and a refresh token."""
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
    """A new access token, so the user stays signed in (Module 1.13)."""
    return await service.refresh_access_token(session, payload.refresh_token)


@router.get(
    "/me",
    response_model=UserRead,
    summary="Get the currently signed-in user",
    responses={
        401: {"description": "Missing, invalid or expired token"},
    },
)
async def me(current_user: CurrentUser) -> UserRead:
    """The user the bearer token belongs to."""
    return UserRead.model_validate(current_user)


def _linkedin_error_redirect(message: str) -> RedirectResponse:
    """Back to the login page with a reason - LinkedIn navigates here, so a JSON
    error would show as a raw page."""
    settings = get_settings()
    return RedirectResponse(f"{settings.frontend_url}/login?linkedin_error={quote(message)}")


@router.get(
    "/linkedin/authorize",
    response_model=LinkedInAuthorizeResponse,
    summary="Get the LinkedIn consent URL",
)
async def linkedin_authorize(response: Response) -> LinkedInAuthorizeResponse:
    """Start a LinkedIn sign-in: set the state cookie and return the consent URL.

    The cookie is what /callback checks against CSRF. No PKCE - ADR 0014.
    """
    settings = get_settings()
    state = linkedin.create_state_token()

    response.set_cookie(
        key=linkedin.STATE_COOKIE_NAME,
        value=state,
        max_age=int(linkedin.STATE_TOKEN_TTL.total_seconds()),
        httponly=True,
        samesite="lax",
        # Only in production: plain-HTTP clients (dev, CI) drop Secure cookies.
        secure=settings.app_env == "production",
    )
    authorize_url = linkedin.build_authorize_url(state=state)
    return LinkedInAuthorizeResponse(authorize_url=authorize_url)


@router.get(
    "/linkedin/callback",
    summary="LinkedIn redirects the browser here after consent",
    response_class=RedirectResponse,
)
async def linkedin_callback(
    request: Request,
    session: SessionDep,
    code: str | None = None,
    state: str | None = None,
) -> RedirectResponse:
    """Finish a LinkedIn sign-in and send the browser back with our own tokens.

    Tokens go in the URL fragment, which never reaches server logs or a Referer.
    """
    cookie_state = request.cookies.get(linkedin.STATE_COOKIE_NAME)

    if not code or not state or not cookie_state or cookie_state != state:
        return _linkedin_error_redirect(_STATE_INVALID)

    try:
        linkedin.decode_state_token(state)
    except jwt.PyJWTError:
        return _linkedin_error_redirect(_STATE_INVALID)

    try:
        account = await linkedin.get_linkedin_account(code=code)
        user = await service.login_with_linkedin(session, account)
    except AppError as exc:
        return _linkedin_error_redirect(exc.detail)

    tokens = service.create_session(user)
    settings = get_settings()
    redirect = RedirectResponse(
        f"{settings.frontend_url}/auth/linkedin/callback"
        f"#access_token={tokens.access_token}&refresh_token={tokens.refresh_token}"
    )
    redirect.delete_cookie(linkedin.STATE_COOKIE_NAME)
    return redirect


@router.post(
    "/role",
    response_model=UserRead,
    summary="Add a role to your account",
    responses={422: {"description": "Not a role you can give yourself (admin is never allowed)"}},
)
async def add_role(
    payload: AddRoleRequest, current_user: CurrentUser, session: SessionDep
) -> UserRead:
    """Add candidate, referrer or recruiter to your roles. A LinkedIn sign-up
    picks its first role here."""
    user = await service.add_user_role(session, current_user, payload.role.value)
    return UserRead.model_validate(user)


@router.post(
    "/password/change",
    response_model=TokenPair,
    summary="Change my password",
    responses={
        400: {
            "description": "Current password is wrong, the new one is the same as the current "
            "one, or the account has no password yet (LinkedIn-only)"
        },
        401: {"description": "Missing, invalid or expired access token"},
        422: {"description": "New password is shorter than 8 or longer than 72 characters"},
    },
)
async def change_password(
    payload: PasswordChangeRequest, current_user: CurrentUser, session: SessionDep
) -> TokenPair:
    """Change your password (Module 1.8). Signs out every other session; store
    the returned tokens in place of the old ones."""
    return await service.change_password(
        session, current_user, payload.current_password, payload.new_password
    )


@router.post(
    "/password-reset/request",
    response_model=PasswordResetRequested,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Email a password reset link",
    responses={422: {"description": "Not a valid email address"}},
)
async def request_password_reset(
    payload: PasswordResetRequest, session: SessionDep, sender: SenderDep
) -> PasswordResetRequested:
    """Email a reset link valid for 30 minutes. Always 202, so it never reveals
    which emails are registered."""
    await service.request_password_reset(session, payload.email, sender)
    return PasswordResetRequested()


@router.post(
    "/password-reset/confirm",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Set a new password from a reset link",
    responses={
        400: {
            "description": "Token is unknown, expired, already used, or replaced by a newer link"
        },
        422: {"description": "New password is shorter than 8 or longer than 72 characters"},
    },
)
async def confirm_password_reset(payload: PasswordResetConfirm, session: SessionDep) -> None:
    """Set the new password from a reset link. Signs the account out everywhere."""
    await service.confirm_password_reset(session, payload.token, payload.new_password)
