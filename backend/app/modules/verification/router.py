"""HTTP layer for the verification module. URL, validation, response shape - no
business logic and no queries. STANDARDS.md §2.3."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.email import EmailSender, get_email_sender
from db import get_session

from . import service
from .schemas import ConfirmCodeRequest, SendCodeRequest, SendCodeResponse, VerificationRead

router = APIRouter(prefix="/verification", tags=["verification"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
SenderDep = Annotated[EmailSender, Depends(get_email_sender)]


@router.post(
    "/email/send",
    response_model=SendCodeResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Email a 6-digit verification code",
    responses={
        401: {"description": "Missing, invalid or expired access token"},
        422: {
            "description": "Not a valid address for this kind - wrong university domain, "
            "university not verifiable by email, or a personal address used as a work email"
        },
        429: {"description": "A code was sent to this address less than 60 seconds ago"},
        503: {"description": "The email provider refused or failed; nothing was sent, retry"},
    },
)
async def send_code(
    payload: SendCodeRequest, current_user: CurrentUser, session: SessionDep, sender: SenderDep
) -> SendCodeResponse:
    """Send a code to a university (`kind=university`) or work (`kind=employer`) email.

    A university address must be on the domain of the university saved on the
    caller's profile, so save the profile first. Sending again replaces the
    previous code. The code is never returned here - only in the email.
    """
    await service.send_code(session, current_user, payload.email, payload.kind, sender)
    return SendCodeResponse(
        email=payload.email.lower(),
        kind=payload.kind,
        expires_in_seconds=int(service.CODE_TTL.total_seconds()),
        resend_after_seconds=int(service.RESEND_COOLDOWN.total_seconds()),
    )


@router.post(
    "/email/confirm",
    response_model=VerificationRead,
    summary="Confirm an email with the code it was sent",
    responses={
        400: {"description": "Code is wrong, expired, already used, or locked after 5 wrong tries"},
        401: {"description": "Missing, invalid or expired access token"},
        422: {"description": "Code is not exactly 6 digits, or an unknown field was sent"},
    },
)
async def confirm_code(
    payload: ConfirmCodeRequest, current_user: CurrentUser, session: SessionDep
) -> VerificationRead:
    """Mark the email verified if the code matches the latest one sent to it.

    Every kind of failure returns the same 400, on purpose: telling a guesser
    whether the code was wrong or expired would help them.
    """
    row = await service.confirm_code(
        session, current_user, payload.email, payload.kind, payload.code
    )
    return VerificationRead.model_validate(row)
