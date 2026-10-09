"""Business rules for proving ownership of a university or work email.

The flow (Module 1.9): send a 6-digit code to the address, the user types it
back, the address is marked verified. Everything that makes that safe lives
here: hashing, expiry, single use, the wrong-guess limit, the resend limit,
and checking the address belongs to the right institution.
"""

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email import EmailDeliveryError, EmailSender
from app.core.exceptions import (
    BadRequestError,
    ServiceUnavailableError,
    TooManyRequestsError,
    UnprocessableError,
)
from app.modules.auth.models import User
from app.modules.profiles import service as profiles_service
from config import get_settings

from . import repository
from .models import EmailVerification, VerificationKind

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
    return await repository.save(session, row)
