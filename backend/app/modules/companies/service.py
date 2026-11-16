"""Business rules for companies: create or join by verified domain (ADR 0020)."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.email import EmailDeliveryError, EmailSender
from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
    TooManyRequestsError,
    UnprocessableError,
)
from app.core.storage import FileStorage
from app.core.uploads import FileKind, read_upload
from app.modules.auth import repository as auth_repository
from app.modules.auth.models import User, UserRole, UserRoleAssignment
from app.modules.verification import repository as verification_repository
from app.modules.verification.models import VerificationKind

from . import repository
from .models import Company, CompanyInvite, MemberRole
from .schemas import (
    CompanyCreate,
    CompanyRead,
    CompanyUpdate,
    InviteCreate,
    InvitePreview,
    InviteRead,
)

_LOGO_TYPES = {FileKind.JPEG, FileKind.PNG}
# Who may change the company's details and logo, and invite people.
_EDITORS = {MemberRole.OWNER, MemberRole.RECRUITER}

INVITE_TTL = timedelta(days=7)
INVITE_RESEND_COOLDOWN = timedelta(seconds=60)
# A team is a handful of people; the list is capped, never unbounded.
MAX_INVITES_LISTED = 200
# Every bad token gets the same answer, so a guesser learns nothing.
_INVALID_INVITE = "This invite link is invalid or has expired. Ask for a new one."


def _on_domain(email: str, domain: str) -> bool:
    host = email.rsplit("@", 1)[-1]
    return host == domain or host.endswith(f".{domain}")


async def get_my_company(session: AsyncSession, user: User) -> CompanyRead:
    """The user's company and role, or 404 if they don't belong to one."""
    membership = await repository.get_membership(session, user.id)
    if membership is None:
        raise NotFoundError("You don't belong to a company yet")
    company, member = membership
    return CompanyRead.of(company, member.role)


async def create_or_join(
    session: AsyncSession, user: User, payload: CompanyCreate
) -> tuple[CompanyRead, bool]:
    """Create the company, or join it if its domain is already on PATRON.

    Needs the recruiter role and a verified work email on the domain.
    Returns the company and whether it was newly created.
    """
    if UserRole.RECRUITER.value not in user.roles:
        raise ForbiddenError("Only recruiters can set up a company")
    if await repository.get_membership(session, user.id) is not None:
        raise ConflictError("You already belong to a company")

    domain = payload.domain
    emails = await verification_repository.list_verified_emails(
        session, user.id, VerificationKind.EMPLOYER
    )
    if not any(_on_domain(email, domain) for email in emails):
        raise UnprocessableError(f"Verify your work email at @{domain} first.")

    existing = await repository.get_by_domain(session, domain)
    if existing is not None:
        return await _join(session, existing, user.id), False

    company = Company(
        name=payload.name,
        domain=domain,
        size=payload.size.value,
        industry=payload.industry.value,
        headquarters=payload.headquarters,
        verified_at=datetime.now(UTC),
        created_by=user.id,
    )
    try:
        company = await repository.create_with_owner(
            session, company, user.id, MemberRole.OWNER.value
        )
    except IntegrityError:
        # Someone created the same domain a moment ago - join theirs instead.
        await session.rollback()
        existing = await repository.get_by_domain(session, domain)
        if existing is None:
            raise
        return await _join(session, existing, user.id), False
    return CompanyRead.of(company, MemberRole.OWNER.value), True


async def _join(session: AsyncSession, company: Company, user_id: uuid.UUID) -> CompanyRead:
    await repository.add_member(session, company.id, user_id, MemberRole.RECRUITER.value)
    return CompanyRead.of(company, MemberRole.RECRUITER.value)


async def _editable_company(session: AsyncSession, user: User) -> tuple[Company, str]:
    membership = await repository.get_membership(session, user.id)
    if membership is None:
        raise NotFoundError("You don't belong to a company yet")
    company, member = membership
    if member.role not in _EDITORS:
        raise ForbiddenError("Only the company's recruiters can change it")
    return company, member.role


async def update_company(session: AsyncSession, user: User, payload: CompanyUpdate) -> CompanyRead:
    """Change only the fields sent."""
    company, role = await _editable_company(session, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is None:
            raise UnprocessableError(f"{field} can't be empty")
        setattr(company, field, value.value if hasattr(value, "value") else value)
    return CompanyRead.of(await repository.save(session, company), role)


async def upload_logo(
    session: AsyncSession, user: User, file: UploadFile, storage: FileStorage
) -> CompanyRead:
    """Replace the logo - PNG or JPG only (ADR 0020)."""
    data, kind = await read_upload(file, _LOGO_TYPES, description="a PNG or JPG image")
    company, role = await _editable_company(session, user)
    old_key = company.logo_key
    company.logo_key = f"logos/{uuid.uuid4()}.{kind.value}"
    await storage.save(company.logo_key, data)
    company = await repository.save(session, company)
    if old_key is not None:
        await storage.delete(old_key)
    return CompanyRead.of(company, role)


async def remove_logo(session: AsyncSession, user: User, storage: FileStorage) -> CompanyRead:
    company, role = await _editable_company(session, user)
    if company.logo_key is not None:
        await storage.delete(company.logo_key)
        company.logo_key = None
        company = await repository.save(session, company)
    return CompanyRead.of(company, role)


async def read_logo(storage: FileStorage, filename: str) -> tuple[bytes, FileKind]:
    """A logo by file name - public, like a profile photo. 404 if not stored."""
    extension = filename.rsplit(".", 1)[-1]
    kind = next((k for k in _LOGO_TYPES if k.value == extension), None)
    try:
        data = await storage.read(f"logos/{filename}") if kind is not None else None
    except ValueError:
        data = None
    if data is None or kind is None:
        raise NotFoundError("Logo not found")
    return data, kind


# --- Team invites (#104) ------------------------------------------------------


def _hash_token(token: str) -> str:
    """Plain SHA-256 is enough: the token is 256 random bits."""
    return hashlib.sha256(token.encode()).hexdigest()


async def _send_invite(
    sender: EmailSender, company: Company, invite: CompanyInvite, inviter: User, token: str
) -> None:
    link = f"{get_settings().frontend_url}/register?invite={token}"
    role = invite.role.replace("_", " ")
    await sender.send(
        to=invite.email,
        subject=f"Join {company.name} on PATRON",
        body=(
            f"{inviter.full_name} invited you to hire with {company.name} on PATRON "
            f"as a {role}.\n\nAccept the invite (the link expires in "
            f"{INVITE_TTL.days} days):\n{link}\n\n"
            "If you weren't expecting this, ignore this email."
        ),
    )


async def invite_member(
    session: AsyncSession, user: User, payload: InviteCreate, sender: EmailSender
) -> InviteRead:
    """Email an invite to a teammate on the company's domain. Sending again
    to a pending invite replaces its link, at most once a minute."""
    company, _ = await _editable_company(session, user)
    email = payload.email.strip().lower()
    if not _on_domain(email, company.domain):
        raise UnprocessableError(f"Invite people with an @{company.domain} email.")

    existing_user = await auth_repository.get_by_email(session, email)
    if existing_user and await repository.is_member(session, company.id, existing_user.id):
        raise ConflictError(f"{email} is already on your team.")

    now = datetime.now(UTC)
    token = secrets.token_urlsafe(32)
    invite = await repository.get_pending_invite(session, company.id, email)
    if invite is not None:
        if now - invite.sent_at < INVITE_RESEND_COOLDOWN:
            raise TooManyRequestsError("This invite was just sent. Try again in a minute.")
        previous = (invite.token_hash, invite.role, invite.expires_at, invite.sent_at)
        invite.token_hash = _hash_token(token)
        invite.role = payload.role.value
        invite.expires_at = now + INVITE_TTL
        invite.sent_at = now
        invite = await repository.save_invite(session, invite)
    else:
        previous = None
        invite = await repository.add_invite(
            session,
            CompanyInvite(
                company_id=company.id,
                email=email,
                role=payload.role.value,
                token_hash=_hash_token(token),
                invited_by=user.id,
                expires_at=now + INVITE_TTL,
                sent_at=now,
            ),
        )

    try:
        await _send_invite(sender, company, invite, user, token)
    except EmailDeliveryError as exc:
        # Undelivered - undo, so the link that never arrived isn't the live one.
        if previous is None:
            await repository.delete_invite(session, invite)
        else:
            invite.token_hash, invite.role, invite.expires_at, invite.sent_at = previous
            await repository.save_invite(session, invite)
        raise ServiceUnavailableError(
            "We couldn't send the invite right now. Please try again in a moment."
        ) from exc
    return InviteRead.model_validate(invite)


async def list_invites(session: AsyncSession, user: User) -> list[InviteRead]:
    """The company's invites, newest first."""
    company, _ = await _editable_company(session, user)
    invites = await repository.list_invites(session, company.id, MAX_INVITES_LISTED)
    return [InviteRead.model_validate(invite) for invite in invites]


async def revoke_invite(session: AsyncSession, user: User, invite_id: uuid.UUID) -> None:
    """Cancel a pending invite; its link stops working."""
    company, _ = await _editable_company(session, user)
    invite = await repository.get_invite(session, company.id, invite_id)
    if invite is None:
        raise NotFoundError("Invite not found")
    if invite.accepted_at is not None:
        raise ConflictError("This invite was already accepted.")
    await repository.delete_invite(session, invite)


async def _open_invite(session: AsyncSession, token: str) -> tuple[CompanyInvite, Company]:
    found = await repository.get_invite_by_hash(session, _hash_token(token))
    if found is None:
        raise NotFoundError(_INVALID_INVITE)
    invite, company = found
    if invite.accepted_at is not None or invite.expires_at <= datetime.now(UTC):
        raise NotFoundError(_INVALID_INVITE)
    return invite, company


async def preview_invite(session: AsyncSession, token: str) -> InvitePreview:
    """Who is inviting, for the sign-up page. Same 404 for every bad token."""
    invite, company = await _open_invite(session, token)
    return InvitePreview(
        company_name=company.name,
        company_domain=company.domain,
        email=invite.email,
        role=invite.role,
    )


async def accept_invite(session: AsyncSession, user: User, token: str) -> CompanyRead:
    """Join the company with the invited role.

    The signed-in email must be the invited one. Following the link proves the
    user owns that address, so it also marks their email verified.
    """
    invite, company = await _open_invite(session, token)
    if user.email != invite.email:
        raise ForbiddenError(f"This invite is for {invite.email}. Sign in with that email.")
    if await repository.get_membership(session, user.id) is not None:
        raise ConflictError("You already belong to a company")

    # Everyone on a hiring team holds the recruiter role in the app.
    if UserRole.RECRUITER.value not in user.roles:
        user.role_assignments.append(UserRoleAssignment(role=UserRole.RECRUITER.value))
    user.is_email_verified = True
    await repository.accept_invite(session, invite, user.id, datetime.now(UTC))
    return CompanyRead.of(company, invite.role)
