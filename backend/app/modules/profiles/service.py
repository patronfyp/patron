"""Business rules for the profiles module."""

import uuid
from datetime import UTC, datetime

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, UnprocessableError
from app.core.storage import FileStorage
from app.core.uploads import FileKind, read_upload
from app.modules.auth.models import User

from . import repository
from .models import ONBOARDING_STEP_COUNT, Profile
from .schemas import ProfileUpdate

_PHOTO_TYPES = {FileKind.JPEG, FileKind.PNG}
_CV_TYPES = {FileKind.PDF, FileKind.DOCX}


async def get_or_create_profile(session: AsyncSession, user: User) -> Profile:
    """Return the user's profile, creating an empty one on first read.

    Creating it here rather than at registration means the sign-up and
    LinkedIn flows never have to know the profile exists.
    """
    profile = await repository.get_by_user_id(session, user.id)
    if profile is None:
        profile = await repository.create_for_user(session, user.id)
    return profile


async def update_profile(session: AsyncSession, user: User, payload: ProfileUpdate) -> Profile:
    """Apply only the fields the client sent.

    The step rule: a user may go back to any earlier step, or forward by one,
    but never skip ahead. Without it a client could jump straight to the last
    step and skip the university and employer steps entirely.
    """
    profile = await get_or_create_profile(session, user)
    changes = payload.model_dump(exclude_unset=True)

    step = changes.get("onboarding_step")
    if step is not None and step > profile.onboarding_step + 1:
        raise UnprocessableError(
            f"Cannot move from step {profile.onboarding_step} to step {step}; "
            "finish the steps in between first."
        )

    # Checked against the saved value too, so sending only one end of the
    # range can't leave the minimum above the maximum.
    salary_min = changes.get("salary_min", profile.salary_min)
    salary_max = changes.get("salary_max", profile.salary_max)
    if salary_min is not None and salary_max is not None and salary_min > salary_max:
        raise UnprocessableError("The minimum salary can't be more than the maximum.")

    for field, value in changes.items():
        setattr(profile, field, value)

    return await repository.save(session, profile)


async def complete_onboarding(session: AsyncSession, user: User) -> Profile:
    """The "Finish setup" button. Only allowed from the last step, so the
    wizard can't be marked done from the middle. Finishing twice is harmless."""
    profile = await get_or_create_profile(session, user)
    if profile.onboarding_completed_at is not None:
        return profile
    if profile.onboarding_step != ONBOARDING_STEP_COUNT:
        raise UnprocessableError("Finish every onboarding step first.")

    profile.onboarding_completed_at = datetime.now(UTC)
    return await repository.save(session, profile)


async def _replace_file(
    storage: FileStorage, folder: str, data: bytes, kind: FileKind, old_key: str | None
) -> str:
    """Store the new file under a fresh random key and remove the old one.

    A fresh key (rather than one per user) means a cached old photo URL never
    shows the new photo, and file names reveal nothing about who owns them.
    """
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
    """A photo by its file name, for anyone - like a LinkedIn profile picture.

    Raises 404 for a name that isn't a stored photo, including any name that
    isn't a well-formed key at all.
    """
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
