"""Request/response shapes for companies. Clients never set ids, the domain's
verification or storage keys."""

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.core.config import get_settings

from .models import CompanySize, Industry, MemberRole

# One or more labels and a TLD, e.g. "garner.com", "eng.garner.com.pk".
_DOMAIN_PATTERN = re.compile(r"^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")


def normalise_domain(website: str) -> str:
    """A website as a bare domain: `https://www.Garner.com/careers` -> `garner.com`.

    Raises ValueError if it isn't a valid domain.
    """
    host = re.sub(r"^[a-z]+://", "", website.strip().lower()).split("/", 1)[0].split(":", 1)[0]
    host = host.removeprefix("www.")
    if not _DOMAIN_PATTERN.fullmatch(host):
        raise ValueError("Enter your company's website, e.g. garner.com")
    return host


def logo_url(logo_key: str | None) -> str | None:
    """The logo's API path (relative, so it works on any host), or None."""
    if logo_key is None:
        return None
    filename = logo_key.split("/", 1)[1]
    return f"{get_settings().api_v1_prefix}/companies/logos/{filename}"


class _CompanyFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    size: CompanySize
    industry: Industry
    headquarters: str = Field(min_length=1, max_length=100)

    @field_validator("name", "headquarters")
    @classmethod
    def _strip(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field is required")
        return cleaned


class CompanyCreate(_CompanyFields):
    """POST /companies/me - create the company, or join it if the domain exists."""

    website: str = Field(min_length=1, max_length=255)

    @computed_field
    @property
    def domain(self) -> str:
        return normalise_domain(self.website)

    @field_validator("website")
    @classmethod
    def _valid_website(cls, value: str) -> str:
        normalise_domain(value)
        return value


class CompanyUpdate(BaseModel):
    """PATCH /companies/me. Only fields sent change; the domain never does."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    size: CompanySize | None = None
    industry: Industry | None = None
    headquarters: str | None = Field(default=None, min_length=1, max_length=100)
    employees_can_refer: bool | None = None

    @field_validator("name", "headquarters")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field can't be empty")
        return cleaned


class CompanyRead(BaseModel):
    """A company plus the signed-in user's role in it."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    domain: str
    size: CompanySize
    industry: Industry
    headquarters: str
    logo_key: str | None = Field(exclude=True)
    employees_can_refer: bool
    verified_at: datetime
    my_role: MemberRole

    @computed_field
    @property
    def logo_url(self) -> str | None:
        return logo_url(self.logo_key)

    @classmethod
    def of(cls, company: object, role: str) -> "CompanyRead":
        """The company row with the caller's role added."""
        fields = {name: getattr(company, name) for name in cls.model_fields if name != "my_role"}
        return cls.model_validate({**fields, "my_role": role})
