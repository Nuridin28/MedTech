"""USD→KZT conversion via the National Bank of Kazakhstan public rate (TZ §5.4).

Cached in Redis for 24h; falls back to a configured constant if the NBK feed is
unavailable so parsing never blocks on it.
"""
from __future__ import annotations

import logging
import xml.etree.ElementTree as ET

import httpx

from app.core.config import settings
from app.core.redis_client import cache_get, cache_set

logger = logging.getLogger(__name__)

NBK_URL = "https://nationalbank.kz/rss/get_rates.cfm?fdate={date}"
_CACHE_KEY = "fx:usd_kzt"


async def get_usd_kzt() -> float:
    cached = await cache_get(_CACHE_KEY)
    if cached:
        return float(cached)

    rate = await _fetch_nbk_usd()
    if rate is None:
        rate = settings.fx_usd_kzt_fallback
        logger.warning("Using fallback USD/KZT rate: %.2f", rate)
    await cache_set(_CACHE_KEY, rate, settings.cache_ttl_fx)
    return rate


async def _fetch_nbk_usd() -> float | None:
    from datetime import datetime, timezone

    date = datetime.now(timezone.utc).strftime("%d.%m.%Y")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(NBK_URL.format(date=date))
            resp.raise_for_status()
        root = ET.fromstring(resp.text)
        for item in root.iter("item"):
            title = item.findtext("title")
            desc = item.findtext("description")
            if title and title.strip().upper() == "USD" and desc:
                return float(desc.replace(",", ".").strip())
    except Exception as exc:  # network / parse issues — caller falls back
        logger.warning("NBK FX fetch failed: %s", exc)
    return None
