"""Business rules for the profiles module."""

import uuid
from datetime import UTC, datetime

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, UnprocessableError
from app.core.storage import FileStorage
from app.core.uploads import FileKind, read_upload
from app.modules.auth import repository as auth_repository
from app.modules.auth.models import User
from app.modules.verification import repository as verification_repository
from app.modules.verification.models import DocumentStatus, VerificationKind

from . import repository
from .models import REFERRER_ONBOARDING_STEP_COUNT, Profile, onboarding_step_count
from .schemas import ProfileUpdate, PublicProfileRead, photo_url

_PHOTO_TYPES = {FileKind.JPEG, FileKind.PNG}
_CV_TYPES = {FileKind.PDF, FileKind.DOCX}


async def get_or_create_profile(session: AsyncSession, user: User) -> Profile:
    """The user's profile, created empty on first read - sign-up never needs to know."""
    profile = await repository.get_by_user_id(session, user.id)
    if profile is None:
        profile = await repository.create_for_user(session, user.id)
    return profile


async def get_public_profile(session: AsyncSession, user_id: uuid.UUID) -> PublicProfileRead:
    """Someone's public profile (Module 1.6). Deactivated accounts are a 404."""
    user = await auth_repository.get_by_id(session, user_id)
    if user is None or not user.is_active:
        raise NotFoundError("Profile not found")

    profile = await repository.get_by_user_id(session, user_id)
    university = await verification_repository.get_latest_verified(
        session, user_id, VerificationKind.UNIVERSITY
    )
    employer = await verification_repository.get_latest_verified(
        session, user_id, VerificationKind.EMPLOYER
    )

    return PublicProfileRead(
        user_id=user.id,
        full_name=user.full_name,
        roles=user.roles,
        photo_url=photo_url(profile.photo_key) if profile else None,
        avatar_url=user.avatar_url,
        headline=profile.headline if profile else None,
        city=profile.city if profile else None,
        bio=profile.bio if profile else None,
        linkedin_url=profile.linkedin_url if profile else None,
        university=profile.university if profile else None,
        degree=profile.degree if profile else None,
        graduation_year=profile.graduation_year if profile else None,
        employer_name=profile.employer_name if profile else None,
        job_title=profile.job_title if profile else None,
        skills=profile.skills if profile else [],
        primary_role=profile.primary_role if profile else None,
        university_verified=university is not None,
        employer_verified=employer is not None,
    )


async def update_profile(session: AsyncSession, user: User, payload: ProfileUpdate) -> Profile:
    """Apply only the fields sent. Steps move forward by one at most, so the
    wizard can't be skipped."""
    profile = await get_or_create_profile(session, user)
    changes = payload.model_dump(exclude_unset=True)

    step = changes.get("onboarding_step")
    if step is not None and step > profile.onboarding_step + 1:
        raise UnprocessableError(
            f"Cannot move from step {profile.onboarding_step} to step {step}; "
            "finish the steps in between first."
        )
    # The schema only knows the longest wizard; a referrer-only one is shorter.
    step_count = onboarding_step_count(user.roles)
    if step is not None and step > step_count:
        raise UnprocessableError(f"Your onboarding has only {step_count} steps.")

    # Checked against the saved value too, so sending only one end of the
    # range can't leave the minimum above the maximum.
    salary_min = changes.get("salary_min", profile.salary_min)
    salary_max = changes.get("salary_max", profile.salary_max)
    if salary_min is not None and salary_max is not None and salary_min > salary_max:
        raise UnprocessableError("The minimum salary can't be more than the maximum.")

    for field, value in changes.items():
        setattr(profile, field, value)

    return await repository.save(session, profile)


async def _has_employer_proof(session: AsyncSession, user_id: uuid.UUID) -> bool:
    """A verified work email, or an employment letter that hasn't been
    rejected - pending ones count, as a person reviews them later."""
    if await verification_repository.get_latest_verified(
        session, user_id, VerificationKind.EMPLOYER
    ):
        return True
    documents = await verification_repository.list_documents(session, user_id)
    return any(
        doc.kind == VerificationKind.EMPLOYER and doc.status != DocumentStatus.REJECTED
        for doc in documents
    )


async def complete_onboarding(session: AsyncSession, user: User) -> Profile:
    """The "Finish setup" button - only from the last step; twice is harmless.

    A referrer-only user also needs a company, a job title and proof they work there.
    """
    profile = await get_or_create_profile(session, user)
    if profile.onboarding_completed_at is not None:
        return profile
    if profile.onboarding_step != onboarding_step_count(user.roles):
        raise UnprocessableError("Finish every onboarding step first.")

    if onboarding_step_count(user.roles) == REFERRER_ONBOARDING_STEP_COUNT:
        if not profile.employer_name or not profile.job_title:
            raise UnprocessableError("Add your company and job title first.")
        if not await _has_employer_proof(session, user.id):
            raise UnprocessableError("Verify your work email or upload an employment letter first.")

    profile.onboarding_completed_at = datetime.now(UTC)
    return await repository.save(session, profile)


async def _replace_file(
    storage: FileStorage, folder: str, data: bytes, kind: FileKind, old_key: str | None
) -> str:
    """Save under a fresh random key and delete the old file. Random keys beat
    caches and say nothing about the owner."""
    key = f"{folder}/{uuid.uuid4()}.{kind.value}"
    await storage.save(key, data)
    if old_key is not None:
        await storage.delete(old_key)
    return key


async def upload_photo(
    session: AsyncSession, user: User, file: UploadFile, storage: FileStorage
) -> Profile:
    data, kind = await read_upload(file, _PHOTO_TYPES, description="a JPG or PNG image")
    profile = await get_or_create_profile(session, user)
    profile.photo_key = await _replace_file(storage, "photos", data, kind, profile.photo_key)
    return await repository.save(session, profile)


async def remove_photo(session: AsyncSession, user: User, storage: FileStorage) -> Profile:
    profile = await get_or_create_profile(session, user)
    if profile.photo_key is not None:
        await storage.delete(profile.photo_key)
        profile.photo_key = None
        profile = await repository.save(session, profile)
    return profile


async def read_photo(storage: FileStorage, filename: str) -> tuple[bytes, FileKind]:
    """A photo by file name, public like a LinkedIn picture. 404 if not a stored photo."""
    extension = filename.rsplit(".", 1)[-1]
    kind = next((k for k in _PHOTO_TYPES if k.value == extension), None)
    try:
        data = await storage.read(f"photos/{filename}") if kind is not None else None
    except ValueError:
        data = None
    if data is None or kind is None:
        raise NotFoundError("Photo not found")
    return data, kind


async def upload_cv(
    session: AsyncSession, user: User, file: UploadFile, storage: FileStorage
) -> Profile:
    data, kind = await read_upload(file, _CV_TYPES, description="a PDF or DOCX file")
    profile = await get_or_create_profile(session, user)
    profile.cv_key = await _replace_file(storage, "cvs", data, kind, profile.cv_key)
    # Shown back to the user; only the last path segment, never a client path.
    profile.cv_filename = (
        (file.filename or f"cv.{kind.value}").replace("\\", "/").split("/")[-1][:255]
    )
    profile.cv_size_bytes = len(data)
    profile.cv_uploaded_at = datetime.now(UTC)
    return await repository.save(session, profile)


async def remove_cv(session: AsyncSession, user: User, storage: FileStorage) -> Profile:
    profile = await get_or_create_profile(session, user)
    if profile.cv_key is not None:
        await storage.delete(profile.cv_key)
        profile.cv_key = None
        profile.cv_filename = None
        profile.cv_size_bytes = None
        profile.cv_uploaded_at = None
        profile = await repository.save(session, profile)
    return profile


async def read_own_cv(
    session: AsyncSession, user: User, storage: FileStorage
) -> tuple[bytes, FileKind, str]:
    """The user's own CV file. Others get access later, through referral
    requests (Module 6) - never through this."""
    profile = await get_or_create_profile(session, user)
    data = await storage.read(profile.cv_key) if profile.cv_key else None
    if data is None or profile.cv_key is None:
        raise NotFoundError("You haven't uploaded a CV")
    kind = FileKind(profile.cv_key.rsplit(".", 1)[-1])
    return data, kind, profile.cv_filename or f"cv.{kind.value}"
