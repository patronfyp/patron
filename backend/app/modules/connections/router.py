"""Connection endpoints: requests, my connections, and where I stand with someone."""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, LimiterDep, SessionDep
from app.core.rate_limit import CONNECTION_REQUESTS_PER_USER

from . import service
from .schemas import (
    ConnectionPage,
    ConnectionRequestCreate,
    ConnectionRequestRead,
    Relationship,
    RelationshipRead,
)

router = APIRouter(prefix="/connections", tags=["connections"])

_UNAUTHORIZED = {401: {"description": "Missing, invalid or expired access token"}}
_NO_REQUEST = {404: {"description": "No such request for you"}}


@router.post(
    "/requests",
    response_model=RelationshipRead,
    status_code=status.HTTP_201_CREATED,
    summary="Ask someone to connect",
    responses={
        **_UNAUTHORIZED,
        200: {"description": "They had already asked you, so you're now connected"},
        404: {"description": "No such user"},
        409: {"description": "Already connected, already asked, or asked too recently"},
        422: {"description": "That's you"},
        429: {"description": "More than 50 requests today"},
    },
)
async def send_request(
    payload: ConnectionRequestCreate,
    response: Response,
    current_user: CurrentUser,
    session: SessionDep,
    limiter: LimiterDep,
) -> RelationshipRead:
    """Send a request (201). If they already asked you, you're connected instead (200)."""
    await limiter.hit(CONNECTION_REQUESTS_PER_USER, str(current_user.id))
    result = await service.send_request(session, current_user, payload.user_id)
    if result.status == Relationship.CONNECTED:
        response.status_code = status.HTTP_200_OK
    return result


@router.get(
    "/requests",
    response_model=list[ConnectionRequestRead],
    summary="List my pending requests",
    responses=_UNAUTHORIZED,
)
async def list_requests(
    current_user: CurrentUser,
    session: SessionDep,
    direction: Literal["received", "sent"] = "received",
) -> list[ConnectionRequestRead]:
    """Requests waiting for me (`received`) or that I sent (`sent`), newest first, at most 100."""
    return await service.list_requests(session, current_user, received=direction == "received")


@router.post(
    "/requests/{request_id}/accept",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Accept a request",
    responses={**_UNAUTHORIZED, **_NO_REQUEST},
)
async def accept_request(
    request_id: uuid.UUID, current_user: CurrentUser, session: SessionDep
) -> None:
    await service.accept_request(session, current_user, request_id)


@router.post(
    "/requests/{request_id}/decline",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Decline a request",
    responses={**_UNAUTHORIZED, **_NO_REQUEST},
)
async def decline_request(
    request_id: uuid.UUID, current_user: CurrentUser, session: SessionDep
) -> None:
    """The sender isn't told; it stays pending for them."""
    await service.decline_request(session, current_user, request_id)


@router.delete(
    "/requests/{request_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Withdraw a request I sent",
    responses={**_UNAUTHORIZED, **_NO_REQUEST},
)
async def cancel_request(
    request_id: uuid.UUID, current_user: CurrentUser, session: SessionDep
) -> None:
    await service.cancel_request(session, current_user, request_id)


@router.get(
    "",
    response_model=ConnectionPage,
    summary="List my connections",
    responses={**_UNAUTHORIZED, 422: {"description": "limit above 100 or a negative offset"}},
)
async def list_connections(
    current_user: CurrentUser,
    session: SessionDep,
    q: Annotated[str | None, Query(max_length=100, description="Part of a name")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ConnectionPage:
    """Newest first, `limit` at a time from `offset`, with each connection's type."""
    query = q.strip() if q else None
    return await service.list_connections(
        session, current_user, query=query or None, limit=limit, offset=offset
    )


@router.get(
    "/with/{user_id}",
    response_model=RelationshipRead,
    summary="Where I stand with someone",
    responses={
        **_UNAUTHORIZED,
        404: {"description": "No such user"},
        422: {"description": "That's you"},
    },
)
async def relationship(
    user_id: uuid.UUID, current_user: CurrentUser, session: SessionDep
) -> RelationshipRead:
    """Connected or not, any pending request, the connection type and mutual connections."""
    return await service.relationship(session, current_user, user_id)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a connection",
    responses={**_UNAUTHORIZED, 404: {"description": "You're not connected"}},
)
async def remove_connection(
    user_id: uuid.UUID, current_user: CurrentUser, session: SessionDep
) -> None:
    await service.remove_connection(session, current_user, user_id)
