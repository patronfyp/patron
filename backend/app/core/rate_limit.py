"""Limits on how often one person or IP can try something (ADR 0021).

Each limit is a counter in Redis that lives for one window: the first attempt
creates it with an expiry, later attempts add to it, and when it expires the
person starts again from zero. If Redis is down we let the request through and
log a warning (fail open), so a cache outage never locks everyone out.
"""

import hashlib
import logging
import math
from dataclasses import dataclass
from datetime import timedelta

from fastapi import Request
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings
from app.core.exceptions import TooManyRequestsError
from app.core.redis import get_redis

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Limit:
    """At most `max_attempts` per `window`, counted separately per `scope`."""

    scope: str
    max_attempts: int
    window: timedelta


# Wrong passwords for one account. Loose per IP, since a campus or office shares one.
LOGIN_PER_EMAIL = Limit("login-email", 5, timedelta(minutes=15))
LOGIN_PER_IP = Limit("login-ip", 30, timedelta(minutes=15))
REGISTER_PER_IP = Limit("register-ip", 5, timedelta(hours=1))
PASSWORD_RESET_PER_EMAIL = Limit("reset-email", 3, timedelta(hours=1))
PASSWORD_RESET_PER_IP = Limit("reset-ip", 20, timedelta(hours=1))
# Guessing a reset token, which is long and random - this only stops floods.
PASSWORD_RESET_CONFIRM_PER_IP = Limit("reset-confirm-ip", 10, timedelta(minutes=15))
# Each code locks after 5 wrong tries; this caps how many new codes, and so guesses.
VERIFICATION_SEND_PER_USER = Limit("code-send-user", 10, timedelta(hours=1))
# Stops one account spamming connection requests.
CONNECTION_REQUESTS_PER_USER = Limit("connect-user", 50, timedelta(days=1))


def client_ip(request: Request) -> str:
    """The caller's IP. Behind a proxy this needs uvicorn's --proxy-headers (#114)."""
    return request.client.host if request.client else "unknown"


def _wait_text(seconds: int) -> str:
    if seconds < 60:
        return f"{seconds} seconds"
    minutes = math.ceil(seconds / 60)
    return "1 minute" if minutes == 1 else f"{minutes} minutes"


class RateLimiter:
    """Counts attempts in Redis. With no Redis (`None`) every check passes."""

    def __init__(self, redis: Redis | None) -> None:
        self._redis = redis

    @staticmethod
    def _key(limit: Limit, identity: str) -> str:
        # Hashed, so Redis never holds an email or IP in plain text.
        digest = hashlib.sha256(identity.strip().lower().encode()).hexdigest()[:32]
        return f"rl:{limit.scope}:{digest}"

    def _refuse(self, seconds_left: int) -> TooManyRequestsError:
        seconds_left = max(seconds_left, 1)
        return TooManyRequestsError(
            f"Too many attempts. Try again in {_wait_text(seconds_left)}.",
            retry_after=seconds_left,
        )

    async def hit(self, limit: Limit, identity: str) -> None:
        """Count one attempt; raise 429 once there are more than allowed."""
        if self._redis is None:
            return
        key = self._key(limit, identity)
        try:
            # One round trip, all or nothing: add one, start the window if this is
            # the first attempt (NX), and read how long the window has left.
            async with self._redis.pipeline(transaction=True) as pipe:
                pipe.incr(key)
                pipe.expire(key, int(limit.window.total_seconds()), nx=True)
                pipe.ttl(key)
                count, _, seconds_left = await pipe.execute()
        except RedisError:
            logger.warning("Rate limiting skipped: Redis unavailable", extra={"scope": limit.scope})
            return
        if count > limit.max_attempts:
            raise self._refuse(seconds_left)

    async def check(self, limit: Limit, identity: str) -> None:
        """Raise 429 if the limit is already used up, without counting this one."""
        if self._redis is None:
            return
        key = self._key(limit, identity)
        try:
            async with self._redis.pipeline(transaction=True) as pipe:
                pipe.get(key)
                pipe.ttl(key)
                count, seconds_left = await pipe.execute()
        except RedisError:
            logger.warning("Rate limiting skipped: Redis unavailable", extra={"scope": limit.scope})
            return
        if count is not None and int(count) >= limit.max_attempts:
            raise self._refuse(seconds_left)

    async def clear(self, limit: Limit, identity: str) -> None:
        """Start over, e.g. after a successful login."""
        if self._redis is None:
            return
        try:
            await self._redis.delete(self._key(limit, identity))
        except RedisError:
            logger.warning(
                "Rate limit not cleared: Redis unavailable", extra={"scope": limit.scope}
            )


def get_rate_limiter() -> RateLimiter:
    """FastAPI dependency. No REDIS_URL means no limits (tests swap in a fake)."""
    return RateLimiter(get_redis() if get_settings().redis_url else None)
