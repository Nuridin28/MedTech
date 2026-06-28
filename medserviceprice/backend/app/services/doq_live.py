"""Live proxy to doq.kz doctors + slots APIs (TZ §3.4 — doctor appointments).

Doctors carry price, rating, specialty and the NEAREST free slot inline, so the list
needs one call. Slots are time-sensitive → fetched live per doctor (short cache).
Nothing is stored: appointment availability must always be fresh. Sorting/filtering
that doq doesn't support (rating/price/soonest/distance) is done here.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

import httpx

from app.core.redis_client import cache_get, cache_set
from app.parsers.doq import DOQ_CITIES

logger = logging.getLogger(__name__)

_BASE = "https://api.doq.kz/api/v1"
_HEADERS = {
    "Accept": "application/json",
    "Accept-Language": "ru",
    "Origin": "https://doq.kz",
    "Referer": "https://doq.kz/",
    "User-Agent": "Mozilla/5.0 (compatible; MedServicePriceBot/2.0; +https://medserviceprice.kz)",
}
_CACHE_DOCTORS = 300   # doctor list — fairly stable
_CACHE_SLOTS = 60      # slots — change often, keep fresh
_CACHE_SPECS = 3600    # specialties — basically static

# our city slug (Title) -> doq city id
_CITY_ID = {name: cid for cid, name in DOQ_CITIES.values()}  # {"Almaty": 3, ...}
_SLUG_BY_CITY = {name: slug for slug, (cid, name) in DOQ_CITIES.items()}


async def _get(path: str, params: dict) -> dict:
    async with httpx.AsyncClient(timeout=18, headers=_HEADERS) as c:
        r = await c.get(f"{_BASE}{path}", params=params)
        r.raise_for_status()
        return r.json()


def _doctor_url(city: str, slug: str | None) -> str | None:
    # Verified via sitemap-doctors.xml: doq doctor pages are /doctor/{slug} (no city).
    return f"https://doq.kz/doctor/{slug}" if slug else None


def _norm_doctor(d: dict, city: str) -> dict:
    services = d.get("services") or []
    branches = {b["id"]: b for b in (d.get("clinic_branches") or [])}
    prices = [
        s.get("discount_price") or s.get("price") or s.get("base_price")
        for s in services
        if (s.get("discount_price") or s.get("price") or s.get("base_price"))
    ]
    specs = sorted(
        {(s.get("service") or {}).get("name") for s in services if (s.get("service") or {}).get("name")}
    )
    slots = [s.get("nearest_slot_datetime") for s in services if s.get("nearest_slot_datetime")]
    br = [
        {
            "id": b["id"], "name": b.get("name"), "address": b.get("address"),
            "clinic_slug": b.get("clinic_slug"),
            "lat": (b.get("location") or {}).get("lat"),
            "lng": (b.get("location") or {}).get("lng"),
            "phone": (b.get("phones") or [None])[0],
        }
        for b in branches.values()
    ]
    fs = d.get("feedback_score")
    return {
        "id": d["id"],
        "name": d.get("name"),
        "avatar_url": d.get("avatar_url"),
        "experience": d.get("experience"),
        "gender": d.get("gender_display"),
        "rating": round(float(fs) / 2, 1) if fs else None,
        "reviews_count": d.get("feedback_count") or 0,
        "specialties": specs,
        "min_price_kzt": float(min(prices)) if prices else None,
        "nearest_slot": min(slots) if slots else None,
        "branches": br,
        "doq_url": _doctor_url(city, d.get("slug")),
        "matching_slots": [],  # filled when a time-window filter is active
    }


def _haversine(lat1, lng1, lat2, lng2) -> float:
    from math import asin, cos, radians, sin, sqrt

    dlat, dlng = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * 6371 * asin(sqrt(a))  # km


def _min_distance(doc: dict, lat: float, lng: float) -> float:
    ds = [
        _haversine(lat, lng, b["lat"], b["lng"])
        for b in doc["branches"]
        if b.get("lat") and b.get("lng")
    ]
    return min(ds) if ds else float("inf")


def _hm_to_min(s: str | None) -> int | None:
    """'15:00' / '15' -> minutes from midnight; None on empty/bad input."""
    if not s:
        return None
    try:
        parts = s.split(":")
        return int(parts[0]) * 60 + (int(parts[1]) if len(parts) > 1 else 0)
    except Exception:
        return None


def _slot_matches(dt_iso: str, on_date: str | None, tf: int | None, tt: int | None) -> bool:
    """on_date: 'YYYY-MM-DD' (None = any day). tf/tt: minute bounds [tf, tt)."""
    try:
        d = datetime.fromisoformat(dt_iso)
    except Exception:
        return False
    if on_date and dt_iso[:10] != on_date:
        return False
    mins = d.hour * 60 + d.minute
    if tf is not None and mins < tf:
        return False
    if tt is not None and mins >= tt:
        return False
    return True


async def _batch_slots(doctor_ids: list[int], date_from: str, date_to: str) -> dict[int, list[str]]:
    """ONE doq call for many doctors → {doctor_id: [open slot datetimes]}."""
    if not doctor_ids:
        return {}
    params = {
        "doctor": ",".join(str(i) for i in doctor_ids),
        "date_from": date_from, "date_to": date_to, "limit": "none",
    }
    try:
        data = await _get("/slots/", params)
    except Exception as exc:
        logger.warning("doq batch slots failed: %s", exc)
        return {}
    raw = data.get("results", data if isinstance(data, list) else [])
    by_doc: dict[int, list[str]] = {}
    for s in raw:
        if s.get("is_open") and s.get("datetime"):
            by_doc.setdefault(s.get("doctor"), []).append(s["datetime"])
    return by_doc


async def list_doctors(
    *, city: str, specialty: int | None = None, q: str | None = None,
    sort: str = "rating", page: int = 1, page_size: int = 20,
    user_lat: float | None = None, user_lng: float | None = None,
    appt_date: str | None = None, time_from: str | None = None, time_to: str | None = None,
) -> dict:
    city_id = _CITY_ID.get(city)
    if city_id is None:
        return {"items": [], "total": 0, "page": page, "page_size": page_size}

    # When a "convenient time" filter is on we must check each candidate's real slots,
    # so we over-fetch a window from offset 0 and paginate the filtered set ourselves.
    time_filter = bool(appt_date or time_from or time_to)
    fetch = 150 if time_filter else max(page_size * 3, 60)
    offset = 0 if time_filter else (page - 1) * page_size
    params = {"city": city_id, "expand": "clinic_branches,services", "limit": fetch, "offset": offset}
    if specialty:
        params["service"] = specialty
    if q:
        params["search"] = q

    ckey = (
        f"doq:docs:{city}:{specialty}:{q}:{sort}:{page}:{page_size}:{user_lat}:{user_lng}"
        f":{appt_date}:{time_from}:{time_to}"
    )
    cached = await cache_get(ckey)
    if cached is not None:
        return cached

    try:
        data = await _get("/doctors/", params)
    except Exception as exc:
        logger.warning("doq doctors fetch failed: %s", exc)
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "error": True}

    total = data.get("count", 0)
    docs = [_norm_doctor(d, city) for d in (data.get("results") or [])]

    # --- convenient-time filter: batch-fetch slots, keep doctors with a match ---
    if time_filter:
        if appt_date:
            df = appt_date
            try:
                dt = (date.fromisoformat(appt_date) + timedelta(days=1)).isoformat()
            except Exception:
                dt = appt_date
        else:
            df = date.today().isoformat()
            dt = (date.today() + timedelta(days=8)).isoformat()
        by_doc = await _batch_slots([d["id"] for d in docs], df, dt)
        tf, tt = _hm_to_min(time_from), _hm_to_min(time_to)
        kept = []
        for d in docs:
            good = sorted(
                s for s in by_doc.get(d["id"], []) if _slot_matches(s, appt_date, tf, tt)
            )
            if good:
                d["matching_slots"] = good[:12]
                kept.append(d)
        docs = kept
        total = len(docs)

    has_loc = user_lat is not None and user_lng is not None
    if sort == "price":
        docs.sort(key=lambda x: (x["min_price_kzt"] is None, x["min_price_kzt"] or 0))
    elif sort == "soonest":
        key = "matching_slots" if time_filter else "nearest_slot"
        docs.sort(key=lambda x: (x[key][0] if x.get("matching_slots") else x["nearest_slot"]) or "9999")
    elif sort == "experience":
        docs.sort(key=lambda x: -(x["experience"] or 0))
    elif sort == "distance" and has_loc:
        docs.sort(key=lambda x: _min_distance(x, user_lat, user_lng))
    else:  # rating (default)
        docs.sort(key=lambda x: -(x["rating"] or 0))

    if time_filter:  # paginate the filtered window ourselves
        start = (page - 1) * page_size
        docs = docs[start : start + page_size]
    else:
        docs = docs[:page_size]

    resp = {"items": docs, "total": total, "page": page, "page_size": page_size}
    await cache_set(ckey, resp, _CACHE_DOCTORS)
    return resp


async def doctor_slots(
    *, doctor_id: int, branch_ids: list[int], date_from: str | None, date_to: str | None
) -> dict:
    df = date_from or date.today().isoformat()
    dt = date_to or (date.today() + timedelta(days=6)).isoformat()
    branches = ",".join(str(b) for b in branch_ids) if branch_ids else ""
    ckey = f"doq:slots:{doctor_id}:{branches}:{df}:{dt}"
    cached = await cache_get(ckey)
    if cached is not None:
        return cached

    params = {"doctor": doctor_id, "date_from": df, "date_to": dt, "limit": "none"}
    if branches:
        params["clinic_branch"] = branches
    try:
        data = await _get("/slots/", params)
    except Exception as exc:
        logger.warning("doq slots fetch failed: %s", exc)
        return {"dates": []}

    raw = data.get("results", data if isinstance(data, list) else [])
    by_date: dict[str, list] = {}
    for s in raw:
        if not s.get("is_open"):
            continue
        dtv = s.get("datetime") or ""
        day = dtv[:10]
        by_date.setdefault(day, []).append(
            {"id": s.get("id"), "time": dtv[11:16], "datetime": dtv, "branch": s.get("clinic_branch")}
        )
    dates = [
        {"date": day, "slots": sorted(slots, key=lambda x: x["time"])}
        for day, slots in sorted(by_date.items())
    ]
    resp = {"dates": dates, "total_slots": sum(len(d["slots"]) for d in dates)}
    await cache_set(ckey, resp, _CACHE_SLOTS)
    return resp


async def specialties(city: str) -> list[dict]:
    city_id = _CITY_ID.get(city)
    if city_id is None:
        return []
    ckey = f"doq:specs:{city}"
    cached = await cache_get(ckey)
    if cached is not None:
        return cached
    try:
        data = await _get(
            "/doctors/", {"city": city_id, "expand": "services", "limit": 300}
        )
    except Exception:
        return []
    seen: dict[int, dict] = {}
    for d in data.get("results") or []:
        for s in d.get("services") or []:
            sv = s.get("service") or {}
            if sv.get("id") and sv.get("name") and sv["id"] not in seen:
                seen[sv["id"]] = {"id": sv["id"], "name": sv["name"], "slug": sv.get("slug")}
    out = sorted(seen.values(), key=lambda x: x["name"])
    await cache_set(ckey, out, _CACHE_SPECS)
    return out
