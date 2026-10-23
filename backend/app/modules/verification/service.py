"""Proving who a user is: 6-digit email codes (Module 1.9) and uploaded
documents, stored as pending until admin review exists (1.10, 1.11)."""

import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
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

from . import repository
from .models import EmailVerification, VerificationDocument, VerificationKind
from .schemas import VerificationStatus, VerifiedEmailRead

_DOCUMENT_TYPES = {FileKind.PDF, FileKind.JPEG, FileKind.PNG}

# Kinds that earn a badge get a notification; the account email doesn't.
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
# Wrong guesses before the code dies. With the cooldown, that's a few tries a
# minute against a million codes.
MAX_ATTEMPTS = 5

# Profile university (lowercased) -> email domain; subdomains count. Until
# universities get a table; any other university uses the document route.
UNIVERSITY_DOMAINS: dict[str, str] = {
    "lahore university of management sciences (lums)": "lums.edu.pk",
    "national university of sciences and technology (nust)": "nust.edu.pk",
    "fast national university of computer and emerging sciences (fast-nuces)": "nu.edu.pk",
    "comsats university islamabad": "comsats.edu.pk",
    "university of engineering and technology (uet) lahore": "uet.edu.pk",
    "information technology university (itu)": "itu.edu.pk",
}

# No company table yet, so a work email is only checked not to be a free mailbox.
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
    """HMAC with SECRET_KEY, so a leaked table can't be brute-forced offline."""
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
        # Proves the sign-up address only; not a way to add a new one.
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
    """Email a fresh code. 422 for the wrong kind of address, 429 within the cooldown."""
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
        # Undelivered - drop it so the cooldown doesn't block a retry.
        await repository.delete(session, row)
        raise ServiceUnavailableError(
            "We couldn't send the email right now. Please try again in a moment."
        ) from exc


async def confirm_code(
    session: AsyncSession, user: User, email: str, kind: str, code: str
) -> EmailVerification:
    """Verify the address if `code` matches the latest one sent.

    Every failure is the same 400, so a guesser learns nothing.
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
    """Store a university or employer document as pending review."""
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
