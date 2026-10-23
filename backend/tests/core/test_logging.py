"""Request logging, the request id header, and the crash handler."""

import logging

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.logging import REQUEST_ID_HEADER, add_request_logging


@pytest.fixture
async def crashing_client() -> AsyncClient:
    """A tiny app with the logging middleware and one route that always fails."""
    app = FastAPI()
    add_request_logging(app)

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("secret detail")

    @app.get("/ok")
    async def ok() -> dict[str, str]:
        return {"status": "ok"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        yield http


async def test_every_response_carries_a_request_id(crashing_client: AsyncClient) -> None:
    response = await crashing_client.get("/ok")

    assert response.status_code == 200
    assert len(response.headers[REQUEST_ID_HEADER]) == 32


async def test_a_request_id_sent_by_the_client_is_kept(crashing_client: AsyncClient) -> None:
    response = await crashing_client.get("/ok", headers={REQUEST_ID_HEADER: "abc123"})

    assert response.headers[REQUEST_ID_HEADER] == "abc123"


async def test_a_crash_is_logged_and_hidden_from_the_client(
    crashing_client: AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="patron"):
        response = await crashing_client.get("/boom?token=leak-me")

    # Only our own logger - the test's HTTP client logs the full URL itself.
    ours = [r for r in caplog.records if r.name == "patron"]
    logged = "\n".join(r.getMessage() + (r.exc_text or "") for r in ours)

    assert response.status_code == 500
    assert response.json() == {"detail": "Something went wrong", "code": "internal_error"}
    assert "secret detail" not in response.text
    assert any(r.exc_info and r.exc_info[0] is RuntimeError for r in ours)
    # The query string can hold OAuth codes and reset tokens - never logged.
    assert "leak-me" not in logged
    assert "GET /boom 500" in logged
