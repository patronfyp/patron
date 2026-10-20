"""Tests for the /health endpoint.

These are the project's first tests, kept deliberately simple so they can be
copied as a starting point. Every test follows the same three steps:

    Arrange - set up whatever the test needs (here: the `client` fixture)
    Act     - do the one thing being tested
    Assert  - check the result

Test names describe the behaviour, not the function being called, so a failure
report reads like a sentence.
"""

from httpx import AsyncClient


async def test_health_returns_ok(client: AsyncClient) -> None:
    """The endpoint responds 200 and reports the service as healthy."""
    # Act
    response = await client.get("/health")

    # Assert
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_health_reports_the_database_as_reachable(client: AsyncClient) -> None:
    """The health check actually queries the database, not just the app.

    This is the part worth testing: an API that answers while its database is
    down must not report itself as healthy.
    """
    response = await client.get("/health")

    assert response.json()["database"] == "ok"


async def test_unknown_route_returns_404(client: AsyncClient) -> None:
    """A negative test: asserting what the system refuses to do.

    Tests that only cover the happy path miss most real bugs.
    """
    response = await client.get("/this-route-does-not-exist")

    assert response.status_code == 404
