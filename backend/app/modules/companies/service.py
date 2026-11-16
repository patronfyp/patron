"""Business rules for companies: create or join by verified domain (ADR 0020)."""

import uuid
from datetime import UTC, datetime

from fastapi import UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, UnprocessableError
from app.core.storage import FileStorage
from app.core.uploads import FileKind, read_upload
from app.modules.auth.models import User, UserRole
from app.modules.verification import repository as verification_repository
from app.modules.verification.models import VerificationKind

from . import repository
from .models import Company, MemberRole
from .schemas import CompanyCreate, CompanyRead, CompanyUpdate

_LOGO_TYPES = {FileKind.JPEG, FileKind.PNG}
# Who may change the company's details and logo.
_EDITORS = {MemberRole.OWNER, MemberRole.RECRUITER}


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
