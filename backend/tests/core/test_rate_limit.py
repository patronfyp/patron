"""Tests for the Redis rate limiter itself (ADR 0021)."""

import asyncio
from datetime import timedelta

import pytest
from fakeredis.aioredis import FakeRedis
from redis.asyncio import Redis

from app.core.exceptions import TooManyRequestsError
from app.core.rate_limit import Limit, RateLimiter

THREE_PER_MINUTE = Limit("test", 3, timedelta(minutes=1))


async def test_allows_up_to_the_limit_then_refuses(limiter: RateLimiter) -> None:
    for _ in range(3):
        await limiter.hit(THREE_PER_MINUTE, "ayesha@garner.com")

    with pytest.raises(TooManyRequestsError) as refused:
        await limiter.hit(THREE_PER_MINUTE, "ayesha@garner.com")

    assert 0 < int(refused.value.headers["Retry-After"]) <= 60
    assert "Try again in 1 minute" in refused.value.detail


async def test_each_identity_has_its_own_count(limiter: RateLimiter) -> None:
    for _ in range(3):
        await limiter.hit(THREE_PER_MINUTE, "ayesha@garner.com")

    await limiter.hit(THREE_PER_MINUTE, "bilal@garner.com")


async def test_email_case_and_spaces_do_not_dodge_the_limit(limiter: RateLimiter) -> None:
    for email in ("ayesha@garner.com", " Ayesha@Garner.com", "AYESHA@GARNER.COM "):
        await limiter.hit(THREE_PER_MINUTE, email)

    with pytest.raises(TooManyRequestsError):
        await limiter.hit(THREE_PER_MINUTE, "ayesha@garner.com")


async def test_the_count_starts_over_when_the_window_ends(redis: FakeRedis) -> None:
    limiter = RateLimiter(redis)
    one_per_second = Limit("test", 1, timedelta(seconds=1))
    await limiter.hit(one_per_second, "x")

    await asyncio.sleep(1.1)

    await limiter.hit(one_per_second, "x")


async def test_check_does_not_count_and_clear_starts_over(limiter: RateLimiter) -> None:
    await limiter.check(THREE_PER_MINUTE, "x")
    for _ in range(3):
        await limiter.hit(THREE_PER_MINUTE, "x")

    with pytest.raises(TooManyRequestsError):
        await limiter.check(THREE_PER_MINUTE, "x")
    await limiter.clear(THREE_PER_MINUTE, "x")
    await limiter.check(THREE_PER_MINUTE, "x")


async def test_redis_never_stores_the_email_itself(redis: FakeRedis) -> None:
    await RateLimiter(redis).hit(THREE_PER_MINUTE, "ayesha@garner.com")

    keys = [key.decode() for key in await redis.keys("*")]

    assert len(keys) == 1
    assert keys[0].startswith("rl:test:")
    assert "ayesha" not in keys[0]


async def test_a_missing_redis_lets_requests_through() -> None:
    """Fail open: an outage logs a warning instead of locking everyone out."""
    down = Redis.from_url("redis://127.0.0.1:1/0", socket_connect_timeout=0.2)
    limiter = RateLimiter(down)
    try:
        for _ in range(5):
            await limiter.hit(THREE_PER_MINUTE, "x")
        await limiter.check(THREE_PER_MINUTE, "x")
        await limiter.clear(THREE_PER_MINUTE, "x")
    finally:
        await down.aclose()
