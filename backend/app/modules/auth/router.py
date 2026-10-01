"""HTTP layer for the auth module. URL, validation, response shape - no
business logic and no queries. STANDARDS.md §2.3."""

from typing import Annotated
from urllib.parse import quote

import jwt
from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.exceptions import AppError
from config import get_settings
from db import get_session

from . import linkedin, service
from .schemas import (
    AccessTokenResponse,
    LinkedInAuthorizeResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    SetRoleRequest,
    TokenPair,
    UserRead,
)

router = APIRouter(prefix="/auth", tags=["auth"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]

# Shown to the user when anything about the LinkedIn round trip - not the
# account-linking rule itself - looks wrong. Deliberately vague: the specific
# reason (missing cookie vs expired vs tampered state) isn't useful to a user
# and would be to an attacker probing the flow.
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


@router.get(
    "/me",
    response_model=UserRead,
    summary="Get the currently signed-in user",
    responses={
        401: {"description": "Missing, invalid or expired token"},
    },
)
async def me(current_user: CurrentUser) -> UserRead:
    """Returns the user identified by the Authorization: Bearer token.

    Exists mainly as the proof that `CurrentUser` (app/api/deps.py) works -
    every future protected endpoint in every module depends on the same
    function this one does.
    """
    return UserRead.model_validate(current_user)


def _linkedin_error_redirect(message: str) -> RedirectResponse:
    """Send the browser back to the login page with a reason it can show,
    rather than a raw JSON error page - this route is hit by a full page
    navigation from LinkedIn, not a fetch() call the frontend can catch."""
    settings = get_settings()
    return RedirectResponse(f"{settings.frontend_url}/login?linkedin_error={quote(message)}")


@router.get(
    "/linkedin/authorize",
    response_model=LinkedInAuthorizeResponse,
    summary="Get the LinkedIn consent URL",
)
async def linkedin_authorize(response: Response) -> LinkedInAuthorizeResponse:
    """Start a LinkedIn sign-in: generates this attempt's signed state token,
    sets it as an httpOnly cookie, and returns the URL the frontend should
    send the browser to.

    The cookie is what makes the state check on /callback an actual CSRF
    defence rather than just a signature check - see linkedin.py. No PKCE -
    see ADR 0014.
    """
    settings = get_settings()
    state = linkedin.create_state_token()

    response.set_cookie(
        key=linkedin.STATE_COOKIE_NAME,
        value=state,
        max_age=int(linkedin.STATE_TOKEN_TTL.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=settings.app_env != "development",
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
    """Exchange the code for LinkedIn's profile, run the account-linking
    rule, and send the browser back to the frontend with our own tokens -
    never LinkedIn's - in the URL fragment, not the query string, so they
    don't end up in server logs or a Referer header.
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
    summary="Set your role after a LinkedIn sign-up",
)
async def set_role(
    payload: SetRoleRequest, current_user: CurrentUser, session: SessionDep
) -> UserRead:
    """LinkedIn never tells us candidate vs company vs both - a LinkedIn
    sign-up reaches the app with role=None (models.py) and is sent here once,
    before the rest of the app, to fill it in.
    """
    user = await service.set_user_role(session, current_user, payload.role.value)
    return UserRead.model_validate(user)
