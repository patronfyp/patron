"""Request/response shapes for connections. Only public profile fields, never emails."""

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict

from .models import ConnectionType


class Relationship(StrEnum):
    """Where I stand with another user - drives the Connect button."""

    NONE = "none"
    CONNECTED = "connected"
    # I asked them. Also shown after they declined, so a decline is never revealed.
    PENDING_SENT = "pending_sent"
    # They asked me.
    PENDING_RECEIVED = "pending_received"


class PersonSummary(BaseModel):
    """A user as lists show them: the public profile's first line."""

    user_id: uuid.UUID
    full_name: str
    # Our uploaded photo (an API path), else the LinkedIn picture, else None.
    photo_url: str | None
    avatar_url: str | None
    headline: str | None
    job_title: str | None
    employer_name: str | None
    university: str | None


class PersonResult(PersonSummary):
    """GET /people - a search result, with what the Connect button needs."""

    # The Verified Alumni / Verified Employee badges.
    university_verified: bool
    employer_verified: bool
    relationship: "Relationship"
    # Set while a request is pending, so the result can accept or withdraw it.
    request_id: uuid.UUID | None


class ConnectionRequestCreate(BaseModel):
    """POST /connections/requests."""

    model_config = ConfigDict(extra="forbid")

    user_id: uuid.UUID


class ConnectionRequestRead(BaseModel):
    """A pending request, with the person on the other side."""

    id: uuid.UUID
    direction: Literal["received", "sent"]
    person: PersonSummary
    created_at: datetime


class ConnectionRead(BaseModel):
    person: PersonSummary
    connection_type: ConnectionType
    # Connections we have in common.
    mutual_count: int
    connected_at: datetime


class ConnectionPage(BaseModel):
    """One page of my connections, and how many there are in all."""

    items: list[ConnectionRead]
    total: int


class RelationshipRead(BaseModel):
    """GET /connections/with/{user_id} - what a profile page needs."""

    user_id: uuid.UUID
    status: Relationship
    # Set while a request is pending, so the page can accept, decline or cancel it.
    request_id: uuid.UUID | None
    # Only once connected.
    connection_type: ConnectionType | None
    mutual_count: int
    # The first few mutual connections, for "Ayesha, Bilal and 3 others".
    mutual: list[PersonSummary]
