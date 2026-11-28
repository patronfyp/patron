"""Database queries for connections - no business decisions here.

People are read as plain columns (not User objects), so a list is one query
with no extra loads per row.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Select, and_, case, func, or_, select, union, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.profiles.models import Profile
from app.modules.verification.models import EmailVerification, VerificationKind

from .models import Connection, ConnectionRequest, RequestStatus, ordered_pair

# The columns a PersonSummary is built from.
_PERSON_COLUMNS = (
    User.id,
    User.full_name,
    User.avatar_url,
    Profile.photo_key,
    Profile.headline,
    Profile.job_title,
    Profile.employer_name,
    Profile.university,
)
_PERSON_KEYS = tuple(column.key for column in _PERSON_COLUMNS)

Person = dict[str, Any]


def _person(row: Any) -> Person:
    """A result row's person columns, by name."""
    mapping = row._mapping
    return {key: mapping[key] for key in _PERSON_KEYS}


def _people() -> Select:
    """Active users with their (optional) profile."""
    return (
        select(*_PERSON_COLUMNS)
        .select_from(User)
        .outerjoin(Profile, Profile.user_id == User.id)
        .where(User.is_active.is_(True))
    )


def _connected_ids(user_id: uuid.UUID) -> Select:
    """The ids of everyone `user_id` is connected to."""
    other = case(
        (Connection.user_a_id == user_id, Connection.user_b_id), else_=Connection.user_a_id
    )
    return select(other).where(
        or_(Connection.user_a_id == user_id, Connection.user_b_id == user_id)
    )


# --- requests ---------------------------------------------------------------


async def get_request(session: AsyncSession, request_id: uuid.UUID) -> ConnectionRequest | None:
    return await session.get(ConnectionRequest, request_id)


async def get_request_between(
    session: AsyncSession, sender_id: uuid.UUID, receiver_id: uuid.UUID
) -> ConnectionRequest | None:
    """The request from `sender_id` to `receiver_id`, in any status."""
    return await session.scalar(
        select(ConnectionRequest).where(
            ConnectionRequest.sender_id == sender_id,
            ConnectionRequest.receiver_id == receiver_id,
        )
    )


async def add_request(session: AsyncSession, request: ConnectionRequest) -> ConnectionRequest:
    session.add(request)
    await session.commit()
    await session.refresh(request)
    return request


async def save_request(session: AsyncSession, request: ConnectionRequest) -> ConnectionRequest:
    await session.commit()
    await session.refresh(request)
    return request


async def delete_request(session: AsyncSession, request: ConnectionRequest) -> None:
    await session.delete(request)
    await session.commit()


async def list_pending(
    session: AsyncSession, user_id: uuid.UUID, *, received: bool, limit: int
) -> list[tuple[ConnectionRequest, Person]]:
    """Pending requests to me (received) or from me (sent), newest first, with
    the person on the other side. A declined request still counts as sent."""
    if received:
        other_id = ConnectionRequest.sender_id
        stmt = select(ConnectionRequest).where(
            ConnectionRequest.receiver_id == user_id,
            ConnectionRequest.status == RequestStatus.PENDING,
        )
    else:
        other_id = ConnectionRequest.receiver_id
        stmt = select(ConnectionRequest).where(
            ConnectionRequest.sender_id == user_id,
            ConnectionRequest.status.in_([RequestStatus.PENDING, RequestStatus.DECLINED]),
        )
    people = _people().subquery()
    stmt = (
        stmt.add_columns(*people.c)
        .join(people, people.c.id == other_id)
        .order_by(ConnectionRequest.created_at.desc(), ConnectionRequest.id)
        .limit(limit)
    )
    rows = (await session.execute(stmt)).all()
    return [(row[0], _person(row)) for row in rows]


# --- connections ------------------------------------------------------------


async def get_connection(
    session: AsyncSession, one: uuid.UUID, other: uuid.UUID
) -> Connection | None:
    return await session.get(Connection, ordered_pair(one, other))


async def connect(
    session: AsyncSession, one: uuid.UUID, other: uuid.UUID, request: ConnectionRequest
) -> None:
    """Add the connection and drop the request that led to it, in one commit."""
    user_a_id, user_b_id = ordered_pair(one, other)
    session.add(Connection(user_a_id=user_a_id, user_b_id=user_b_id))
    await session.delete(request)
    await session.commit()


async def delete_connection(session: AsyncSession, connection: Connection) -> None:
    await session.delete(connection)
    await session.commit()


async def list_connections(
    session: AsyncSession, user_id: uuid.UUID, *, query: str | None, limit: int, offset: int
) -> tuple[list[tuple[Person, datetime]], int]:
    """One page of my connections, newest first, and the total that match."""
    other = case(
        (Connection.user_a_id == user_id, Connection.user_b_id), else_=Connection.user_a_id
    ).label("other_id")
    mine = (
        select(other, Connection.created_at)
        .where(or_(Connection.user_a_id == user_id, Connection.user_b_id == user_id))
        .subquery()
    )
    people = _people().subquery()
    base = select(*people.c, mine.c.created_at).join(people, people.c.id == mine.c.other_id)
    if query:
        base = base.where(people.c.full_name.icontains(query, autoescape=True))

    total = await session.scalar(select(func.count()).select_from(base.subquery()))
    rows = (
        await session.execute(
            base.order_by(mine.c.created_at.desc(), people.c.id).limit(limit).offset(offset)
        )
    ).all()
    return [(_person(row), row.created_at) for row in rows], total or 0


async def mutual(
    session: AsyncSession, me: uuid.UUID, other: uuid.UUID, *, limit: int
) -> tuple[int, list[Person]]:
    """How many connections two users share, and the first few by name."""
    shared = _connected_ids(me).intersect(_connected_ids(other)).subquery()
    shared_ids = select(shared.c[0])
    count = await session.scalar(select(func.count()).select_from(shared))
    first = (
        await session.execute(
            _people().where(User.id.in_(shared_ids)).order_by(User.full_name, User.id).limit(limit)
        )
    ).all()
    return count or 0, [_person(row) for row in first]


async def mutual_counts(
    session: AsyncSession, me: uuid.UUID, others: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    """For each of `others`, how many of my connections they are connected to
    too - one grouped query for a whole page, not one per person."""
    if not others:
        return {}
    my_ids = select(_connected_ids(me).subquery().c[0])
    # A connection is stored once, so look at both sides: `person` is one of
    # `others`, `friend` the other end, which must be one of mine.
    side_a = select(
        Connection.user_a_id.label("person"), Connection.user_b_id.label("friend")
    ).where(Connection.user_a_id.in_(others), Connection.user_b_id.in_(my_ids))
    side_b = select(
        Connection.user_b_id.label("person"), Connection.user_a_id.label("friend")
    ).where(Connection.user_b_id.in_(others), Connection.user_a_id.in_(my_ids))
    both = union_all(side_a, side_b).subquery()
    rows = await session.execute(
        select(both.c.person, func.count().label("count")).group_by(both.c.person)
    )
    return {row.person: row.count for row in rows}


async def verified_emails(
    session: AsyncSession, user_ids: list[uuid.UUID]
) -> list[tuple[uuid.UUID, str, str]]:
    """(user_id, kind, email) for every verified university and employer email."""
    rows = await session.execute(
        select(EmailVerification.user_id, EmailVerification.kind, EmailVerification.email).where(
            EmailVerification.user_id.in_(user_ids),
            EmailVerification.verified_at.is_not(None),
            EmailVerification.kind.in_([VerificationKind.UNIVERSITY, VerificationKind.EMPLOYER]),
        )
    )
    return [(row.user_id, row.kind, row.email) for row in rows]


def _contains(query: str) -> str:
    """An ILIKE pattern for "contains `query`", with its own % and _ escaped."""
    escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


async def search_people(
    session: AsyncSession, me: uuid.UUID, query: str, *, limit: int
) -> list[Person]:
    """Active users whose name, job title, company or university contains
    `query`, names starting with it first.

    ILIKE on the raw columns, so the trigram indexes are used. Each table is
    searched on its own and the ids combined (UNION): an OR across a join
    would make Postgres scan instead.
    """
    pattern = _contains(query)
    by_name = select(User.id).where(User.full_name.ilike(pattern, escape="\\"))
    by_profile = select(Profile.user_id).where(
        or_(
            Profile.job_title.ilike(pattern, escape="\\"),
            Profile.employer_name.ilike(pattern, escape="\\"),
            Profile.university.ilike(pattern, escape="\\"),
        )
    )
    matches = union(by_name, by_profile).subquery()
    name_starts = User.full_name.ilike(f"{pattern[1:]}", escape="\\")
    rows = await session.execute(
        _people()
        .where(User.id.in_(select(matches.c[0])), User.id != me)
        .order_by(case((name_starts, 0), else_=1), User.full_name, User.id)
        .limit(limit)
    )
    return [_person(row) for row in rows]


async def relationships(
    session: AsyncSession, me: uuid.UUID, others: list[uuid.UUID]
) -> tuple[set[uuid.UUID], dict[uuid.UUID, ConnectionRequest], dict[uuid.UUID, ConnectionRequest]]:
    """For many users at once: who I'm connected to, my requests to them that
    still show as pending (pending or declined), and their pending ones to me.
    Two queries however many users."""
    if not others:
        return set(), {}, {}
    other = case((Connection.user_a_id == me, Connection.user_b_id), else_=Connection.user_a_id)
    connected = set(
        await session.scalars(
            select(other).where(
                or_(
                    and_(Connection.user_a_id == me, Connection.user_b_id.in_(others)),
                    and_(Connection.user_b_id == me, Connection.user_a_id.in_(others)),
                )
            )
        )
    )
    requests = await session.scalars(
        select(ConnectionRequest).where(
            or_(
                and_(
                    ConnectionRequest.sender_id == me,
                    ConnectionRequest.receiver_id.in_(others),
                    ConnectionRequest.status.in_([RequestStatus.PENDING, RequestStatus.DECLINED]),
                ),
                and_(
                    ConnectionRequest.receiver_id == me,
                    ConnectionRequest.sender_id.in_(others),
                    ConnectionRequest.status == RequestStatus.PENDING,
                ),
            )
        )
    )
    sent: dict[uuid.UUID, ConnectionRequest] = {}
    received: dict[uuid.UUID, ConnectionRequest] = {}
    for request in requests:
        if request.sender_id == me:
            sent[request.receiver_id] = request
        else:
            received[request.sender_id] = request
    return connected, sent, received


async def get_person(session: AsyncSession, user_id: uuid.UUID) -> Person | None:
    """One active user as a summary, or None."""
    row = (await session.execute(_people().where(User.id == user_id))).first()
    return _person(row) if row else None
