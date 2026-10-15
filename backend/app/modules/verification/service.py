"""Business rules for proving who a user is.

Email codes (Module 1.9): send a 6-digit code to the address, the user types
it back, the address is marked verified. Everything that makes that safe lives
here: hashing, expiry, single use, the wrong-guess limit, the resend limit,
and checking the address belongs to the right institution.

Documents (Modules 1.10, 1.11): an uploaded transcript or employment letter,
stored as pending until admin review exists.
"""

import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email import EmailDeliveryError, EmailSender
from app.core.exceptions import (
    BadRequestError,
    ServiceUnavailableError,
    TooManyRequestsError,
    UnprocessableError,
)
from app.core.storage import FileStorage
from app.core.uploads import FileKind, read_upload
from app.modules.auth.models import User
from app.modules.notifications import service as notifications_service
from app.modules.notifications.models import NotificationType
from app.modules.profiles import service as profiles_service
from config import get_settings

from . import repository
from .models import EmailVerification, VerificationDocument, VerificationKind
from .schemas import VerificationStatus, VerifiedEmailRead

_DOCUMENT_TYPES = {FileKind.PDF, FileKind.JPEG, FileKind.PNG}

# The kinds that earn a badge, and how a notification names them. The account
# email has no badge, so it gets no notification - the user is looking at the
# screen that confirmed it.
_BADGE_TITLES = {
    VerificationKind.UNIVERSITY: "University",
    VerificationKind.EMPLOYER: "Work",
}
_DOCUMENT_TITLES = {
    VerificationKind.UNIVERSITY: "University document received",
    VerificationKind.EMPLOYER: "Employment document received",
}

CODE_TTL = timedelta(minutes=10)
RESEND_COOLDOWN = timedelta(seconds=60)
# After this many wrong guesses the code stops working and a new one must be
# sent. With the resend cooldown, this caps guessing at a few attempts a minute
# against a million possible codes.
MAX_ATTEMPTS = 5

# Universities we can verify by email domain, matched against the university
# saved on the user's profile (case-insensitive). Subdomains count, so a
# student address like `x@seecs.nust.edu.pk` matches `nust.edu.pk`.
# A stopgap until universities get their own table; a university missing here
# goes through the registrar-record route instead.
UNIVERSITY_DOMAINS: dict[str, str] = {
    "lahore university of management sciences (lums)": "lums.edu.pk",
    "national university of sciences and technology (nust)": "nust.edu.pk",
    "fast national university of computer and emerging sciences (fast-nuces)": "nu.edu.pk",
    "comsats university islamabad": "comsats.edu.pk",
    "university of engineering and technology (uet) lahore": "uet.edu.pk",
    "information technology university (itu)": "itu.edu.pk",
}

# There is no company table yet, so a work address cannot be matched to a
# specific employer's domain. Until there is, the best available check is that
# it is not a personal mailbox anyone can sign up for.
FREE_EMAIL_DOMAINS = frozenset(
    {
        "gmail.com",
        "googlemail.com",
        "yahoo.com",
        "outlook.com",
        "hotmail.com",
        "live.com",
        "icloud.com",
        "proton.me",
        "protonmail.com",
    }
)

_INVALID_CODE = "That code is wrong or has expired. Request a new one and try again."


def _hash_code(code: str) -> str:
    """Keyed hash of the code. Keyed with SECRET_KEY so a leaked table alone
    cannot be brute-forced offline - all million codes would hash differently
    without the key."""
    key = get_settings().secret_key.encode()
    return hmac.new(key, code.encode(), hashlib.sha256).hexdigest()


def _generate_code() -> str:
    """Six digits from a cryptographic source, leading zeros kept."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _domain_matches(email_domain: str, allowed: str) -> bool:
    return email_domain == allowed or email_domain.endswith("." + allowed)


async def _check_domain(session: AsyncSession, user: User, email: str, kind: str) -> None:
    domain = email.rsplit("@", 1)[1]

    if kind == VerificationKind.ACCOUNT:
        # Only the address on the account - this proves the sign-up, it is not
        # a way to attach a new address.
        if email != user.email:
            raise UnprocessableError("Verify the email address you signed up with.")
        if user.is_email_verified:
            raise UnprocessableError("Your email is already verified.")
        return

    if kind == VerificationKind.UNIVERSITY:
        profile = await profiles_service.get_or_create_profile(session, user)
        university = (profile.university or "").strip().lower()
        allowed = UNIVERSITY_DOMAINS.get(university)
        if allowed is None:
            raise UnprocessableError(
                "Your university can't be verified by email yet. Use the registrar record option."
            )
        if not _domain_matches(domain, allowed):
            raise UnprocessableError(f"Use your university email address ending in @{allowed}.")
        return

    if domain in FREE_EMAIL_DOMAINS:
        raise UnprocessableError("Use your work email address, not a personal one.")


async def send_code(
    session: AsyncSession, user: User, email: str, kind: str, sender: EmailSender
) -> None:
    """Create a fresh code for this address and email it.

    Raises 422 if the address is the wrong kind of address, 429 if a code was
    sent to it less than RESEND_COOLDOWN ago.
    """
    email = email.strip().lower()
    await _check_domain(session, user, email, kind)

    now = datetime.now(UTC)
    latest = await repository.get_latest(session, user.id, email, kind)
    if latest is not None and now - latest.created_at < RESEND_COOLDOWN:
        wait = int((RESEND_COOLDOWN - (now - latest.created_at)).total_seconds()) + 1
        raise TooManyRequestsError(f"Please wait {wait} seconds before requesting another code.")

    code = _generate_code()
    row = await repository.create(
        session,
        user_id=user.id,
        email=email,
        kind=kind,
        code_hash=_hash_code(code),
        expires_at=now + CODE_TTL,
    )

    minutes = int(CODE_TTL.total_seconds() // 60)
    try:
        await sender.send(
            to=email,
            subject="Your PATRON verification code",
            body=(
                f"Your PATRON verification code is {code}.\n\n"
                f"It expires in {minutes} minutes. If you didn't ask for it, ignore this email."
            ),
        )
    except EmailDeliveryError as exc:
        # The code never reached the user, so it must not count: leaving the
        # row would block a retry for RESEND_COOLDOWN with nothing to show.
        await repository.delete(session, row)
        raise ServiceUnavailableError(
            "We couldn't send the email right now. Please try again in a moment."
        ) from exc


async def confirm_code(
    session: AsyncSession, user: User, email: str, kind: str, code: str
) -> EmailVerification:
    """Mark the address verified if `code` matches the latest one sent.

    Every failure - no code sent, expired, already used, too many wrong
    guesses, or simply wrong - is the same 400 with the same message, so the
    response never tells a guesser which of those it hit.
    """
    email = email.strip().lower()
    row = await repository.get_latest(session, user.id, email, kind)

    now = datetime.now(UTC)
    if (
        row is None
        or row.verified_at is not None
        or row.expires_at <= now
        or row.attempts >= MAX_ATTEMPTS
    ):
        raise BadRequestError(_INVALID_CODE)

    if not hmac.compare_digest(row.code_hash, _hash_code(code)):
        row.attempts += 1
        await repository.save(session, row)
        raise BadRequestError(_INVALID_CODE)

    row.verified_at = now
    if kind == VerificationKind.ACCOUNT:
        # Saved in the same commit as the code, so the two can't disagree.
        user.is_email_verified = True
    row = await repository.save(session, row)

    if kind in _BADGE_TITLES:
        await notifications_service.notify(
            session,
            user.id,
            NotificationType.EMAIL_VERIFIED,
            f"{_BADGE_TITLES[kind]} email verified",
            body=f"{email} is now verified.",
            link="/onboarding",
        )
    return row


async def upload_document(
    session: AsyncSession, user: User, kind: str, file: UploadFile, storage: FileStorage
) -> VerificationDocument:
    """Store a transcript, degree or employment letter as pending review.

    Only university and employer documents - the account email is proven by
    code alone.
    """
    if kind == VerificationKind.ACCOUNT:
        raise UnprocessableError("Documents are only for university or employer verification.")

    data, file_kind = await read_upload(file, _DOCUMENT_TYPES, description="a PDF, JPG or PNG file")
    key = f"documents/{uuid.uuid4()}.{file_kind.value}"
    await storage.save(key, data)
    filename = (file.filename or f"document.{file_kind.value}").replace("\\", "/").split("/")[-1]
    document = await repository.create_document(
        session,
        user_id=user.id,
        kind=kind,
        file_key=key,
        filename=filename[:255],
        size_bytes=len(data),
    )

    await notifications_service.notify(
        session,
        user.id,
        NotificationType.DOCUMENT_UPLOADED,
        _DOCUMENT_TITLES[kind],
        body=f"{document.filename} is waiting for review. We'll let you know once it's checked.",
        link="/onboarding",
    )
    return document


async def get_status(session: AsyncSession, user: User) -> VerificationStatus:
    """Everything the user has proven so far, for the onboarding summary."""

    async def latest(kind: VerificationKind) -> VerifiedEmailRead | None:
        row = await repository.get_latest_verified(session, user.id, kind)
        if row is None or row.verified_at is None:
            return None
        return VerifiedEmailRead(email=row.email, verified_at=row.verified_at)

    return VerificationStatus(
        email=user.email,
        email_verified=user.is_email_verified,
        university_email=await latest(VerificationKind.UNIVERSITY),
        employer_email=await latest(VerificationKind.EMPLOYER),
        documents=await repository.list_documents(session, user.id),
    )
