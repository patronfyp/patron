"""Request/response shapes for the verification module.

The code itself is never returned by any endpoint - it only ever leaves the
server inside the email.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import VerificationKind


class SendCodeRequest(BaseModel):
    """What a client sends to POST /verification/email/send."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    kind: VerificationKind


class SendCodeResponse(BaseModel):
    """Returned by /send. The two numbers drive the "Resend in 0:42" timer."""

    email: str
    kind: VerificationKind
    expires_in_seconds: int
    resend_after_seconds: int


class ConfirmCodeRequest(BaseModel):
    """What a client sends to POST /verification/email/confirm."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    kind: VerificationKind
    code: str = Field(pattern=r"^\d{6}$", description="The 6-digit code from the email")


class VerificationRead(BaseModel):
    """Returned by /confirm once the code is accepted."""

    model_config = ConfigDict(from_attributes=True)

    email: str
    kind: VerificationKind
    verified_at: datetime
