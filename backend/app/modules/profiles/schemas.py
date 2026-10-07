"""Request/response shapes for the profiles module.

Separate Update/Read schemas, always - STANDARDS.md §3.4. A client can set only
the fields listed in ProfileUpdate; `id`, `user_id` and timestamps are never
accepted from the outside.
"""

from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import ONBOARDING_STEP_COUNT

# Earliest graduation year we accept. Anything before this is a typo, not an
# alumnus - the platform is for people who are working or about to.
_MIN_GRADUATION_YEAR = 1950
# A student can be several years from graduating, but not decades.
_MAX_YEARS_AHEAD = 8


class ProfileRead(BaseModel):
    """Returned by GET and PATCH /profile/me."""

    model_config = ConfigDict(from_attributes=True)

    university: str | None
    degree: str | None
    graduation_year: int | None
    employer_name: str | None
    onboarding_step: int


class ProfileUpdate(BaseModel):
    """What a client sends to PATCH /profile/me.

    Every field is optional: only the ones sent are changed. Sending a text
    field as null clears it. `onboarding_step` cannot be cleared, only moved.
    """

    # A typo like `universty` should fail loudly, not be silently ignored.
    model_config = ConfigDict(extra="forbid")

    university: str | None = Field(default=None, max_length=200)
    degree: str | None = Field(default=None, max_length=150)
    graduation_year: int | None = None
    employer_name: str | None = Field(default=None, max_length=200)
    onboarding_step: int = Field(default=1, ge=1, le=ONBOARDING_STEP_COUNT)

    @field_validator("university", "degree", "employer_name")
    @classmethod
    def _strip_text(cls, value: str | None) -> str | None:
        """Trim whitespace; a field that is only spaces counts as cleared."""
        if value is None:
            return None
        return value.strip() or None

    @field_validator("graduation_year")
    @classmethod
    def _plausible_year(cls, value: int | None) -> int | None:
        if value is None:
            return None
        latest = datetime.now(UTC).year + _MAX_YEARS_AHEAD
        if not _MIN_GRADUATION_YEAR <= value <= latest:
            raise ValueError(f"graduation_year must be between {_MIN_GRADUATION_YEAR} and {latest}")
        return value
