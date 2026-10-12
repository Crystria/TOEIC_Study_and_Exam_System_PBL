from __future__ import annotations

import datetime
from typing import Callable

import redis.asyncio as redis


class RedisClient:
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._client = redis.from_url(redis_url, decode_responses=True)

    @property
    def client(self) -> redis.Redis:
        return self._client

    async def close(self) -> None:
        await self._client.aclose()


async def get_redis_client(redis_url: str) -> RedisClient:
    return RedisClient(redis_url)


# Token bucket rate limiting for max messages/day per user
TOKEN_BUCKET_LUA_SCRIPT = """
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_seconds = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local window_start = math.floor(now / window_seconds) * window_seconds
local bucket_key = key .. ':' .. window_start

local count = tonumber(redis.call('GET', bucket_key) or '0')
if count >= limit then
    return {0, limit, count}
end

count = redis.call('INCR', bucket_key)
redis.call('EXPIRE', bucket_key, window_seconds + 10)
return {1, limit, count}
"""


async def check_rate_limit(
    redis_client: redis.Redis,
    user_id: str,
    limit: int,
    window_seconds: int = 86400,  # 1 day
) -> tuple[bool, int, int]:
    """Check rate limit using token bucket (sliding window by day). Returns (allowed, limit, count)."""
    now = datetime.datetime.now(datetime.timezone.utc).timestamp()
    result = await redis_client.eval(
        TOKEN_BUCKET_LUA_SCRIPT,
        1,
        f"ai:rate_limit:{user_id}",
        str(limit),
        str(window_seconds),
        str(int(now)),
    )
    allowed = bool(result[0]) if isinstance(result, list) and len(result) > 0 else False
    limit_val = int(result[1]) if isinstance(result, list) and len(result) > 1 else limit
    count_val = int(result[2]) if isinstance(result, list) and len(result) > 2 else 0
    return allowed, limit_val, count_val


async def refund_rate_limit(
    redis_client: redis.Redis,
    user_id: str,
    window_seconds: int = 86400,
) -> None:
    """Refund quota when using fallback response due to circuit breaker."""
    now = datetime.datetime.now(datetime.timezone.utc).timestamp()
    window_start = int(now / window_seconds) * window_seconds
    bucket_key = f"ai:rate_limit:{user_id}:{window_start}"
    # Decrement count if > 0 (best effort)
    await redis_client.decr(bucket_key)


# TODO: Implement more robust token bucket semantics if needed
DependencyType = Callable[..., object]