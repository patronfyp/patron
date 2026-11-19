"""One shared Redis client for the app (ADR 0021). Today it only holds rate-limit
counters; later the background queue and real-time updates use it too."""

from functools import lru_cache

from redis.asyncio import Redis

from app.core.config import get_settings

# Short timeouts: a slow or missing Redis must not hold up a login (we fail open).
_TIMEOUT_SECONDS = 0.5


@lru_cache
def get_redis() -> Redis:
    """Created once on first use; connections are pooled inside the client."""
    return Redis.from_url(
        get_settings().redis_url,
        socket_timeout=_TIMEOUT_SECONDS,
        socket_connect_timeout=_TIMEOUT_SECONDS,
    )


async def close_redis() -> None:
    """Close the pool on shutdown, if it was ever opened."""
    if get_redis.cache_info().currsize:
        await get_redis().aclose()
        get_redis.cache_clear()
