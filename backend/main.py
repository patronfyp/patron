"""Patron API - application entry point.

Minimal scaffold: configuration, CORS and a health check. No feature routes yet.

Run locally:
    uv run uvicorn main:app --reload
"""

from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from db import get_session

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Vouched, Verified, Hired.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@app.get("/health", tags=["system"])
async def health(session: SessionDep) -> dict[str, str]:
    """Liveness check - used by the frontend and by deployment health probes.

    Reports the database separately so a reachable API with an unreachable
    database is not mistaken for a healthy system.
    """
    try:
        await session.execute(text("SELECT 1"))
        database = "ok"
    except SQLAlchemyError:
        database = "unreachable"

    return {"status": "ok", "env": settings.app_env, "database": database}
