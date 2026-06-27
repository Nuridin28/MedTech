"""Redis fixed-window rate limiting helpers (TZ §11).

Used by the AI assistant gateway to cap per-IP bursts/day and to enforce a global
daily ceiling on OpenAI calls (cost guard). Fail-OPEN on Redis errors for the
per-IP limits (don't take the feature down if Redis hiccups) but fail-CLOSED on the
global budget counter (never overspend when we can't read the counter).
"""
from __future__ import annotations

from app.core.redis_client import get_redis


async def hit_limit(key: str, limit: int, window_seconds: int) -> bool:
    """Increment a fixed-window counter. Returns True if the caller is OVER the limit.

    Fail-open: if Redis is unavailable we allow the request (the LLM call itself is
    still bounded by timeouts and the global budget guard).
    """
    try:
        r = get_redis()
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, window_seconds)
        return count > limit
    except Exception:
        return False


async def over_daily_budget(key: str, limit: int) -> bool:
    """Global daily call ceiling. Fail-closed: if we can't read/inc the counter we
    treat it as over-budget so a Redis outage can't turn into unbounded spend."""
    try:
        r = get_redis()
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, 86400)
        return count > limit
    except Exception:
        return True
