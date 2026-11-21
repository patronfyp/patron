"""Business rules for connections (Module 3, ADR 0023)."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, UnprocessableError
from app.modules.auth.models import User
from app.modules.notifications.models import NotificationType
from app.modules.notifications.service import notify
from app.modules.profiles.schemas import photo_url
from app.modules.verification.models import VerificationKind

from . import repository
from .models import ConnectionRequest, ConnectionType, RequestStatus
from .repository import Person
from .schemas import (
    ConnectionPage,
    ConnectionRead,
    ConnectionRequestRead,
    PersonSummary,
    Relationship,
    RelationshipRead,
)

# After a decline or a withdrawal, the same sender waits this long to ask again.
ASK_AGAIN_AFTER = timedelta(days=30)
# Requests are a handful at a time; the list is capped, never unbounded.
MAX_REQUESTS_LISTED = 100
MUTUAL_SHOWN = 3
_TOO_SOON = "You can send this person another request later."


def _summary(person: Person) -> PersonSummary:
    return PersonSummary(
        user_id=person["id"],
        full_name=person["full_name"],
        photo_url=photo_url(person["photo_key"]),
        avatar_url=person["avatar_url"],
        headline=person["headline"],
        job_title=person["job_title"],
        employer_name=person["employer_name"],
        university=person["university"],
    )


async def _types(
    session: AsyncSession, me: uuid.UUID, others: list[uuid.UUID]
) -> dict[uuid.UUID, ConnectionType]:
    """The connection type with each of `others`, from verified email domains.

    Alumni: a verified email at the same university. Both: that and the same
    employer. Professional: everything else. One query for the whole list.
    """
    domains: dict[uuid.UUID, dict[str, set[str]]] = {}
    for user_id, kind, email in await repository.verified_emails(session, [me, *others]):
        domains.setdefault(user_id, {}).setdefault(kind, set()).add(email.rsplit("@", 1)[-1])

    mine = domains.get(me, {})
    types = {}
    for other in others:
        theirs = domains.get(other, {})
        same_university = bool(
            mine.get(VerificationKind.UNIVERSITY, set())
            & theirs.get(VerificationKind.UNIVERSITY, set())
        )
        same_employer = bool(
            mine.get(VerificationKind.EMPLOYER, set())
            & theirs.get(VerificationKind.EMPLOYER, set())
        )
        if same_university and same_employer:
            types[other] = ConnectionType.BOTH
        elif same_university:
            types[other] = ConnectionType.ALUMNI
        else:
            types[other] = ConnectionType.PROFESSIONAL
    return types


async def _other_user(session: AsyncSession, user: User, other_id: uuid.UUID) -> Person:
    if other_id == user.id:
        raise UnprocessableError("You can't connect with yourself")
    person = await repository.get_person(session, other_id)
    if person is None:
        raise NotFoundError("User not found")
    return person


def _too_soon(request: ConnectionRequest) -> bool:
    responded = request.responded_at or request.created_at
    return datetime.now(UTC) - responded < ASK_AGAIN_AFTER


async def send_request(session: AsyncSession, user: User, other_id: uuid.UUID) -> RelationshipRead:
    """Ask `other_id` to connect. If they already asked me, this accepts it."""
    await _other_user(session, user, other_id)
    if await repository.get_connection(session, user.id, other_id) is not None:
        raise ConflictError("You're already connected")

    theirs = await repository.get_request_between(session, other_id, user.id)
    if theirs is not None and theirs.status == RequestStatus.PENDING:
        await _accept(session, user, theirs)
        return await relationship(session, user, other_id)

    mine = await repository.get_request_between(session, user.id, other_id)
    if mine is None:
        try:
            mine = await repository.add_request(
                session, ConnectionRequest(sender_id=user.id, receiver_id=other_id)
            )
        except IntegrityError:
            # A double click: the other click's request is already there.
            await session.rollback()
            raise ConflictError("You've already sent a request") from None
    elif mine.status == RequestStatus.PENDING:
        raise ConflictError("You've already sent a request")
    elif mine.status == RequestStatus.DECLINED:
        # Same answer as pending: the sender is never told about a decline.
        raise ConflictError("You've already sent a request")
    elif _too_soon(mine):
        raise ConflictError(_TOO_SOON)
    else:
        mine.status = RequestStatus.PENDING
        mine.responded_at = None
        mine.created_at = datetime.now(UTC)
        mine = await repository.save_request(session, mine)

    await notify(
        session,
        other_id,
        NotificationType.CONNECTION_REQUEST,
        f"{user.full_name} wants to connect",
        link="/connections",
    )
    return await relationship(session, user, other_id)


async def _accept(session: AsyncSession, user: User, request: ConnectionRequest) -> None:
    try:
        await repository.connect(session, request.sender_id, request.receiver_id, request)
    except IntegrityError:
        # Accepted twice at once: the connection exists, which is the goal.
        await session.rollback()
        return
    await notify(
        session,
        request.sender_id,
        NotificationType.CONNECTION_ACCEPTED,
        f"{user.full_name} accepted your request",
        link="/connections",
    )


async def _received(session: AsyncSession, user: User, request_id: uuid.UUID) -> ConnectionRequest:
    request = await repository.get_request(session, request_id)
    if request is None or request.receiver_id != user.id or request.status != RequestStatus.PENDING:
        raise NotFoundError("No such request")
    return request


async def accept_request(session: AsyncSession, user: User, request_id: uuid.UUID) -> None:
    await _accept(session, user, await _received(session, user, request_id))


async def decline_request(session: AsyncSession, user: User, request_id: uuid.UUID) -> None:
    """Decline quietly: the sender keeps seeing it as pending."""
    request = await _received(session, user, request_id)
    request.status = RequestStatus.DECLINED
    request.responded_at = datetime.now(UTC)
    await repository.save_request(session, request)


async def cancel_request(session: AsyncSession, user: User, request_id: uuid.UUID) -> None:
    """Withdraw my request. Asking again waits ASK_AGAIN_AFTER either way."""
    request = await repository.get_request(session, request_id)
    if (
        request is None
        or request.sender_id != user.id
        or request.status
        not in (
            RequestStatus.PENDING,
            RequestStatus.DECLINED,
        )
    ):
        raise NotFoundError("No such request")
    if request.status == RequestStatus.PENDING:
        request.responded_at = datetime.now(UTC)
    request.status = RequestStatus.WITHDRAWN
    await repository.save_request(session, request)


async def list_requests(
    session: AsyncSession, user: User, *, received: bool
) -> list[ConnectionRequestRead]:
    rows = await repository.list_pending(
        session, user.id, received=received, limit=MAX_REQUESTS_LISTED
    )
    direction = "received" if received else "sent"
    return [
        ConnectionRequestRead(
            id=request.id,
            direction=direction,
            person=_summary(person),
            created_at=request.created_at,
        )
        for request, person in rows
    ]


async def list_connections(
    session: AsyncSession, user: User, *, query: str | None, limit: int, offset: int
) -> ConnectionPage:
    rows, total = await repository.list_connections(
        session, user.id, query=query, limit=limit, offset=offset
    )
    types = await _types(session, user.id, [person["id"] for person, _ in rows])
    return ConnectionPage(
        items=[
            ConnectionRead(
                person=_summary(person),
                connection_type=types[person["id"]],
                connected_at=connected_at,
            )
            for person, connected_at in rows
        ],
        total=total,
    )


async def remove_connection(session: AsyncSession, user: User, other_id: uuid.UUID) -> None:
    connection = await repository.get_connection(session, user.id, other_id)
    if connection is None:
        raise NotFoundError("You're not connected")
    await repository.delete_connection(session, connection)


async def relationship(session: AsyncSession, user: User, other_id: uuid.UUID) -> RelationshipRead:
    """Where I stand with `other_id`, for their profile page."""
    await _other_user(session, user, other_id)
    status, request_id, connection_type = Relationship.NONE, None, None

    if await repository.get_connection(session, user.id, other_id) is not None:
        status = Relationship.CONNECTED
        connection_type = (await _types(session, user.id, [other_id]))[other_id]
    else:
        mine = await repository.get_request_between(session, user.id, other_id)
        theirs = await repository.get_request_between(session, other_id, user.id)
        if theirs is not None and theirs.status == RequestStatus.PENDING:
            status, request_id = Relationship.PENDING_RECEIVED, theirs.id
        elif mine is not None and mine.status in (RequestStatus.PENDING, RequestStatus.DECLINED):
            status, request_id = Relationship.PENDING_SENT, mine.id

    mutual_count, mutual = await repository.mutual(session, user.id, other_id, limit=MUTUAL_SHOWN)
    return RelationshipRead(
        user_id=other_id,
        status=status,
        request_id=request_id,
        connection_type=connection_type,
        mutual_count=mutual_count,
        mutual=[_summary(person) for person in mutual],
    )
