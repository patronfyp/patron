"""Company endpoints: my company, create or join, details and logo."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Response, UploadFile, status

from app.api.deps import CurrentUser, SessionDep
from app.core.email import EmailSender, get_email_sender
from app.core.storage import FileStorage, get_file_storage
from app.core.uploads import CONTENT_TYPES

from . import service
from .schemas import (
    CompanyCreate,
    CompanyRead,
    CompanyUpdate,
    InviteCreate,
    InvitePreview,
    InviteRead,
    InviteToken,
)

router = APIRouter(prefix="/companies", tags=["companies"])

StorageDep = Annotated[FileStorage, Depends(get_file_storage)]
SenderDep = Annotated[EmailSender, Depends(get_email_sender)]

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


@router.post(
    "/me/invites",
    response_model=InviteRead,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a teammate",
    responses={
        **_UNAUTHORIZED,
        **_NO_COMPANY,
        **_NOT_EDITOR,
        409: {"description": "Already on the team"},
        422: {"description": "Not an email on the company's domain, or not an invitable role"},
        429: {"description": "Sent to this email less than a minute ago"},
        503: {"description": "The email couldn't be sent; nothing changed"},
    },
)
async def invite_member(
    payload: InviteCreate, current_user: CurrentUser, session: SessionDep, sender: SenderDep
) -> InviteRead:
    """Email an invite link. Sending again to a pending invite replaces its link."""
    return await service.invite_member(session, current_user, payload, sender)


@router.get(
    "/me/invites",
    response_model=list[InviteRead],
    summary="List my company's invites",
    responses={**_UNAUTHORIZED, **_NO_COMPANY, **_NOT_EDITOR},
)
async def list_invites(current_user: CurrentUser, session: SessionDep) -> list[InviteRead]:
    """Pending, accepted and expired invites, newest first."""
    return await service.list_invites(session, current_user)


@router.delete(
    "/me/invites/{invite_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel an invite",
    responses={
        **_UNAUTHORIZED,
        **_NOT_EDITOR,
        404: {"description": "No such invite at your company"},
        409: {"description": "Already accepted"},
    },
)
async def revoke_invite(
    invite_id: uuid.UUID, current_user: CurrentUser, session: SessionDep
) -> None:
    """Cancel a pending invite; its link stops working."""
    await service.revoke_invite(session, current_user, invite_id)


@router.post(
    "/invites/preview",
    response_model=InvitePreview,
    summary="See who an invite link is from",
    responses={404: {"description": "Invalid, expired or already used"}},
)
async def preview_invite(payload: InviteToken, session: SessionDep) -> InvitePreview:
    """For the sign-up page, before an account exists. The token goes in the
    body so it never appears in a URL or a log."""
    return await service.preview_invite(session, payload.token)


@router.post(
    "/invites/accept",
    response_model=CompanyRead,
    summary="Accept an invite",
    responses={
        **_UNAUTHORIZED,
        403: {"description": "The invite is for a different email"},
        404: {"description": "Invalid, expired or already used"},
        409: {"description": "You already belong to a company"},
    },
)
async def accept_invite(
    payload: InviteToken, current_user: CurrentUser, session: SessionDep
) -> CompanyRead:
    """Join the inviting company with the invited role, right after sign-up or
    sign-in. Also marks your email verified."""
    return await service.accept_invite(session, current_user, payload.token)
