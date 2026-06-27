"""Redis cache helper — cache-aside strategy (TZ §9)."""
from __future__ import annotations

import json
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
    return _redis


async def cache_get(key: str) -> Any | None:
    try:
        raw = await get_redis().get(key)
        return json.loads(raw) if raw else None
    except Exception:  # cache must never take down a request
        return None


async def cache_set(key: str, value: Any, ttl: int) -> None:
    try:
        await get_redis().set(key, json.dumps(value, default=str), ex=ttl)
    except Exception:
        pass


async def cache_delete_pattern(pattern: str) -> int:
    """Targeted invalidation after a parse completes (TZ §9)."""
    try:
        r = get_redis()
        deleted = 0
        async for key in r.scan_iter(match=pattern, count=200):
            await r.delete(key)
            deleted += 1
        return deleted
    except Exception:
        return 0
