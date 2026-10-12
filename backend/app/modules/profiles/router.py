"""HTTP layer for the profiles module. URL, validation, response shape - no
business logic and no queries. STANDARDS.md §2.3."""

from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.storage import FileStorage, get_file_storage
from app.core.uploads import CONTENT_TYPES
from db import get_session

from . import service
from .schemas import ProfileRead, ProfileUpdate

router = APIRouter(prefix="/profile", tags=["profile"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
StorageDep = Annotated[FileStorage, Depends(get_file_storage)]

_UNAUTHORIZED = {401: {"description": "Missing, invalid or expired access token"}}
_BAD_FILE = {422: {"description": "Empty, larger than 5 MB, or not an accepted file type"}}


@router.get(
    "/me",
    response_model=ProfileRead,
    summary="Get my profile",
    responses=_UNAUTHORIZED,
)
async def get_my_profile(current_user: CurrentUser, session: SessionDep) -> ProfileRead:
    """Return the signed-in user's profile and onboarding progress.

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
        **_UNAUTHORIZED,
        422: {
            "description": "Validation failed - e.g. an implausible graduation year, a bad "
            "phone or LinkedIn URL, salary minimum above maximum, an unknown field, or an "
            "onboarding step more than one ahead of the saved step"
        },
    },
)
async def update_my_profile(
    payload: ProfileUpdate, current_user: CurrentUser, session: SessionDep
) -> ProfileRead:
    """Change only the fields sent; everything else is left as it was.

    `onboarding_step` may go back to any earlier step or forward by one, never
    further - so the wizard cannot be skipped by calling the API directly.
    Sending a text field as null clears it, and `[]` clears a list.
    """
    profile = await service.update_profile(session, current_user, payload)
    return ProfileRead.model_validate(profile)


@router.post(
    "/me/onboarding/complete",
    response_model=ProfileRead,
    summary="Finish onboarding",
    responses={**_UNAUTHORIZED, 422: {"description": "Not on the last onboarding step yet"}},
)
async def complete_onboarding(current_user: CurrentUser, session: SessionDep) -> ProfileRead:
    """The "Finish setup" button. After this, sign-in goes to the app instead
    of back into the wizard. Calling it again changes nothing."""
    profile = await service.complete_onboarding(session, current_user)
    return ProfileRead.model_validate(profile)


@router.put(
    "/me/photo",
    response_model=ProfileRead,
    summary="Upload my profile photo",
    responses={**_UNAUTHORIZED, **_BAD_FILE},
)
async def upload_photo(
    current_user: CurrentUser,
    session: SessionDep,
    storage: StorageDep,
    file: Annotated[UploadFile, File(description="A JPG or PNG image, up to 5 MB")],
) -> ProfileRead:
    """Replace the profile photo. The type is checked from the file itself,
    not its name. The old photo is deleted."""
    profile = await service.upload_photo(session, current_user, file, storage)
    return ProfileRead.model_validate(profile)


@router.delete(
    "/me/photo",
    response_model=ProfileRead,
    summary="Remove my profile photo",
    responses=_UNAUTHORIZED,
)
async def remove_photo(
    current_user: CurrentUser, session: SessionDep, storage: StorageDep
) -> ProfileRead:
    profile = await service.remove_photo(session, current_user, storage)
    return ProfileRead.model_validate(profile)


@router.get(
    "/photos/{filename}",
    summary="Get a profile photo",
    response_class=Response,
    responses={200: {"content": {"image/jpeg": {}, "image/png": {}}}, 404: {}},
)
async def get_photo(filename: str, storage: StorageDep) -> Response:
    """Public, like a LinkedIn profile picture - this is the URL `photo_url`
    points at. File names are random, so they can't be guessed or listed."""
    data, kind = await service.read_photo(storage, filename)
    return Response(
        content=data,
        media_type=CONTENT_TYPES[kind],
        # The name changes whenever the photo does, so it can be cached forever.
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.put(
    "/me/cv",
    response_model=ProfileRead,
    summary="Upload my CV",
    responses={**_UNAUTHORIZED, **_BAD_FILE},
)
async def upload_cv(
    current_user: CurrentUser,
    session: SessionDep,
    storage: StorageDep,
    file: Annotated[UploadFile, File(description="A PDF or DOCX file, up to 5 MB")],
) -> ProfileRead:
    """Replace the CV. The type is checked from the file itself, not its name.
    The old CV is deleted."""
    profile = await service.upload_cv(session, current_user, file, storage)
    return ProfileRead.model_validate(profile)


@router.delete(
    "/me/cv",
    response_model=ProfileRead,
    summary="Remove my CV",
    responses=_UNAUTHORIZED,
)
async def remove_cv(
    current_user: CurrentUser, session: SessionDep, storage: StorageDep
) -> ProfileRead:
    profile = await service.remove_cv(session, current_user, storage)
    return ProfileRead.model_validate(profile)


@router.get(
    "/me/cv",
    summary="Download my CV",
    response_class=Response,
    responses={**_UNAUTHORIZED, 404: {"description": "No CV uploaded"}},
)
async def download_cv(
    current_user: CurrentUser, session: SessionDep, storage: StorageDep
) -> Response:
    """Your own CV only. Nobody else can read it through this endpoint."""
    data, kind, filename = await service.read_own_cv(session, current_user, storage)
    return Response(
        content=data,
        media_type=CONTENT_TYPES[kind],
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
            "Cache-Control": "private, no-store",
        },
    )
