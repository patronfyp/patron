"""Connections between users (Module 3) and the requests that lead to them."""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RequestStatus(StrEnum):
    PENDING = "pending"
    # Declined and withdrawn rows are kept for a while, so the same sender
    # can't ask again straight away. The sender is never told about a decline.
    DECLINED = "declined"
    WITHDRAWN = "withdrawn"


class ConnectionType(StrEnum):
    """Worked out from verified emails each time, never stored (ADR 0023)."""

    PROFESSIONAL = "professional"
    ALUMNI = "alumni"
    BOTH = "both"


class ConnectionRequest(Base):
    """One person asking another to connect. Accepting deletes it and adds a Connection."""

    __tablename__ = "connection_requests"
    __table_args__ = (
        CheckConstraint("sender_id <> receiver_id", name="ck_connection_requests_not_self"),
        # One request per direction; a declined one stays until it is replaced.
        Index("uq_connection_requests_pair", "sender_id", "receiver_id", unique=True),
        # "Requests waiting for me" - the inbox query.
        Index("ix_connection_requests_receiver_status", "receiver_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    receiver_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # Values come from RequestStatus.
    status: Mapped[str] = mapped_column(
        String(20), default=RequestStatus.PENDING, server_default=RequestStatus.PENDING.value
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<ConnectionRequest {self.sender_id} -> {self.receiver_id} {self.status}>"


class Connection(Base):
    """Two connected users, stored once: the smaller id is always `user_a_id`."""

    __tablename__ = "connections"
    __table_args__ = (
        CheckConstraint("user_a_id < user_b_id", name="ck_connections_ordered_pair"),
        # The primary key serves "connections where user_a is me"; this one user_b.
        Index("ix_connections_user_b_id", "user_b_id"),
    )

    user_a_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    user_b_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<Connection {self.user_a_id} <-> {self.user_b_id}>"


def ordered_pair(one: uuid.UUID, other: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    """The two ids in the order a Connection stores them."""
    return (one, other) if one < other else (other, one)
