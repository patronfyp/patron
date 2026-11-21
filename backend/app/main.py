"""Patron API entry point: settings, middleware, error handling, routers.

Run locally (from backend/):
    uv run uvicorn app.main:app --reload
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import SessionDep
from app.core.config import get_settings
from app.core.exceptions import AppError
from app.core.logging import add_request_logging, setup_logging
from app.core.redis import close_redis
from app.modules.auth.router import router as auth_router
from app.modules.companies.router import router as companies_router
from app.modules.connections.router import router as connections_router
from app.modules.jobs.router import router as jobs_router
from app.modules.notifications.router import router as notifications_router
from app.modules.profiles.router import router as profiles_router
from app.modules.verification.router import router as verification_router

settings = get_settings()
setup_logging(debug=settings.debug)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    yield
    await close_redis()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Vouched, Verified, Hired.",
    lifespan=lifespan,
)

# Added before CORS so CORS wraps it: even a 500 carries CORS headers, and the
# browser shows the real error instead of a CORS one.
add_request_logging(app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Lets the frontend read how long a 429 asks it to wait.
    expose_headers=["Retry-After"],
)


@app.exception_handler(AppError)
async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    """Every AppError becomes `{detail, code}` with its status - STANDARDS.md §3.7."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": exc.code},
        headers=exc.headers or None,
    )


app.include_router(auth_router, prefix=settings.api_v1_prefix)
app.include_router(profiles_router, prefix=settings.api_v1_prefix)
app.include_router(verification_router, prefix=settings.api_v1_prefix)
app.include_router(notifications_router, prefix=settings.api_v1_prefix)
app.include_router(companies_router, prefix=settings.api_v1_prefix)
app.include_router(jobs_router, prefix=settings.api_v1_prefix)
app.include_router(connections_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["system"])
async def health(session: SessionDep) -> dict[str, str]:
    """Liveness check. Reports the database separately from the API."""
    try:
        await session.execute(text("SELECT 1"))
        database = "ok"
    except SQLAlchemyError:
        database = "unreachable"

    return {"status": "ok", "env": settings.app_env, "database": database}
