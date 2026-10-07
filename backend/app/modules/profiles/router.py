"""HTTP layer for the profiles module. URL, validation, response shape - no
business logic and no queries. STANDARDS.md §2.3."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from db import get_session

from . import service
from .schemas import ProfileRead, ProfileUpdate

router = APIRouter(prefix="/profile", tags=["profile"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get(
    "/me",
    response_model=ProfileRead,
    summary="Get my profile",
    responses={401: {"description": "Missing, invalid or expired access token"}},
)
async def get_my_profile(current_user: CurrentUser, session: SessionDep) -> ProfileRead:
    """Return the signed-in user's institutional fields and onboarding step.

    An empty profile at step 1 is created on first read, so a new user always
    gets a valid response. There is no user id in the URL: you can only ever
    see your own profile.
    """
    profile = await service.get_or_create_profile(session, current_user)
    return ProfileRead.model_validate(profile)


@router.patch(
    "/me",
    response_model=ProfileRead,
    summary="Update my profile",
    responses={
        401: {"description": "Missing, invalid or expired access token"},
        422: {
            "description": "Validation failed - implausible graduation year, unknown field, "
            "or an onboarding step more than one ahead of the saved step"
        },
    },
)
async def update_my_profile(
    payload: ProfileUpdate, current_user: CurrentUser, session: SessionDep
) -> ProfileRead:
    """Change only the fields sent; everything else is left as it was.

    `onboarding_step` may go back to any earlier step or forward by one, never
    further - so the wizard cannot be skipped by calling the API directly.
    Sending a text field as null clears it.
    """
    profile = await service.update_profile(session, current_user, payload)
    return ProfileRead.model_validate(profile)
