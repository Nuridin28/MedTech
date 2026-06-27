"""Clinic geocoding (TZ §3.4 map) — OSM Nominatim with a city-centre fallback.

Nominatim is public and keyless but rate-limited (≤1 req/s, UA required). We look
up "address, city, Kazakhstan"; if that fails we drop the marker on the city centre
so the map always has a point. Only public clinic addresses are sent — no PII.
"""
from __future__ import annotations

import logging
import time

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Approximate city centres — fallback so every clinic still shows on the map.
CITY_CENTERS: dict[str, tuple[float, float]] = {
    "Almaty": (43.2389, 76.8897),
    "Astana": (51.1605, 71.4704),
    "Shymkent": (42.3417, 69.5901),
    "Karaganda": (49.8047, 73.1094),
    "Aktobe": (50.2839, 57.1670),
    "Taraz": (42.9000, 71.3667),
    "Pavlodar": (52.2873, 76.9674),
}


def geocode(address: str | None, city: str) -> tuple[float, float] | None:
    """Return (lat, lng). Tries Nominatim, falls back to the city centre."""
    if settings.geocode_enabled and address:
        coords = _nominatim(f"{address}, {city}, Kazakhstan")
        if coords:
            return coords
    if settings.geocode_enabled and city:
        coords = _nominatim(f"{city}, Kazakhstan")
        if coords:
            return coords
    return CITY_CENTERS.get(city)


def _nominatim(query: str) -> tuple[float, float] | None:
    try:
        with httpx.Client(timeout=15, headers={"User-Agent": settings.parser_user_agent}) as c:
            resp = c.get(
                settings.geocode_url,
                params={"q": query, "format": "json", "limit": 1, "countrycodes": "kz"},
            )
            resp.raise_for_status()
            data = resp.json()
        time.sleep(1.1)  # Nominatim fair-use: ≤1 req/s
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as exc:
        logger.warning("geocode failed for %r: %s", query, exc)
    return None
