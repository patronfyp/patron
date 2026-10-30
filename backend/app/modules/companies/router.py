"""Company endpoints: my company, create or join, details and logo."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, Response, UploadFile, status

from app.api.deps import CurrentUser, SessionDep
from app.core.storage import FileStorage, get_file_storage
from app.core.uploads import CONTENT_TYPES

from . import service
from .schemas import CompanyCreate, CompanyRead, CompanyUpdate

router = APIRouter(prefix="/companies", tags=["companies"])

StorageDep = Annotated[FileStorage, Depends(get_file_storage)]

_UNAUTHORIZED = {401: {"description": "Missing, invalid or expired access token"}}
_NO_COMPANY = {404: {"description": "You don't belong to a company yet"}}
_NOT_EDITOR = {403: {"description": "Only the company's owner or recruiters can change it"}}


@router.get(
    "/me",
    response_model=CompanyRead,
    summary="Get my company",
    responses={**_UNAUTHORIZED, **_NO_COMPANY},
)
async def get_my_company(current_user: CurrentUser, session: SessionDep) -> CompanyRead:
    """The company you belong to, with your role in it."""
    return await service.get_my_company(session, current_user)


@router.post(
    "/me",
    response_model=CompanyRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create or join my company",
    responses={
        **_UNAUTHORIZED,
        200: {"description": "The domain was already on PATRON - you joined that company"},
        403: {"description": "Only recruiters can set up a company"},
        409: {"description": "You already belong to a company"},
        422: {"description": "No verified work email on this domain, or invalid fields"},
    },
)
async def create_or_join(
    payload: CompanyCreate, response: Response, current_user: CurrentUser, session: SessionDep
) -> CompanyRead:
    """Create your company (201), or join it if its domain is already here (200).

    Needs a verified work email on the website's domain (ADR 0020).
    """
    company, created = await service.create_or_join(session, current_user, payload)
    if not created:
        response.status_code = status.HTTP_200_OK
    return company


@router.patch(
    "/me",
    response_model=CompanyRead,
    summary="Update my company",
    responses={**_UNAUTHORIZED, **_NO_COMPANY, **_NOT_EDITOR},
)
async def update_my_company(
    payload: CompanyUpdate, current_user: CurrentUser, session: SessionDep
) -> CompanyRead:
    """Change only the fields sent. The domain never changes."""
    return await service.update_company(session, current_user, payload)


@router.put(
    "/me/logo",
    response_model=CompanyRead,
    summary="Upload my company's logo",
    responses={
        **_UNAUTHORIZED,
        **_NO_COMPANY,
        **_NOT_EDITOR,
        422: {"description": "Empty, larger than 5 MB, or not a PNG or JPG"},
    },
)
async def upload_logo(
    current_user: CurrentUser,
    session: SessionDep,
    storage: StorageDep,
    file: Annotated[UploadFile, File(description="A PNG or JPG image, up to 5 MB")],
) -> CompanyRead:
    """Replace the logo. The type is read from the file itself; SVG is refused."""
    return await service.upload_logo(session, current_user, file, storage)


@router.delete(
    "/me/logo",
    response_model=CompanyRead,
    summary="Remove my company's logo",
    responses={**_UNAUTHORIZED, **_NO_COMPANY, **_NOT_EDITOR},
)
async def remove_logo(
    current_user: CurrentUser, session: SessionDep, storage: StorageDep
) -> CompanyRead:
    return await service.remove_logo(session, current_user, storage)


@router.get(
    "/logos/{filename}",
    summary="Get a company logo",
    response_class=Response,
    responses={200: {"content": {"image/jpeg": {}, "image/png": {}}}, 404: {}},
)
async def get_logo(filename: str, storage: StorageDep) -> Response:
    """Public - shown on every job and referral. File names are random."""
    data, kind = await service.read_logo(storage, filename)
    return Response(
        content=data,
        media_type=CONTENT_TYPES[kind],
        # The name changes whenever the logo does, so it can be cached forever.
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
