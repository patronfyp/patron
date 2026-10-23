"""Logging setup, one log line per request, and a catch-all for crashes."""

import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("patron")

REQUEST_ID_HEADER = "X-Request-ID"


def setup_logging(*, debug: bool) -> None:
    """Configure the root logger once, at startup."""
    logging.basicConfig(
        level=logging.DEBUG if debug else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        force=True,
    )


def add_request_logging(app: FastAPI) -> None:
    """Log every request and tag it with an id the client can quote back."""

    @app.middleware("http")
    async def log_request(request: Request, call_next):
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            # Path only, never the query string: it can carry OAuth codes and reset tokens.
            logger.exception("%s %s failed id=%s", request.method, request.url.path, request_id)
            response = JSONResponse(
                status_code=500,
                content={"detail": "Something went wrong", "code": "internal_error"},
            )
        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "%s %s %s %.0fms id=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request_id,
        )
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
