"""Business rules for the profiles module."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnprocessableError
from app.modules.auth.models import User

from . import repository
from .models import Profile
from .schemas import ProfileUpdate


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

    for field, value in changes.items():
        setattr(profile, field, value)

    return await repository.save(session, profile)
