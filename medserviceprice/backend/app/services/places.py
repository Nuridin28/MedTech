"""Official Places API integration for ratings / reviews / photos.

Reviews, ratings and photos are sourced ONLY from an official API (2GIS Catalog,
or Google Places) — never scraped from maps (against their ToS) and never with
extra PII. OFF by default: with `PLACES_PROVIDER=none` or no API key, every call
is a safe no-op. Enable by setting PLACES_PROVIDER + the matching key.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ReviewItem:
    external_id: str
    rating: float | None
    text: str | None
    author_alias: str | None
    published_at: str | None  # ISO string
    url: str | None = None


@dataclass
class PlaceInfo:
    place_id: str
    source: str
    rating: float | None = None
    reviews_count: int | None = None
    photo_url: str | None = None
    address: str | None = None
    working_hours: str | None = None
    lat: float | None = None
    lng: float | None = None
    reviews: list[ReviewItem] = field(default_factory=list)


def enabled() -> bool:
    if settings.places_provider == "2gis":
        return bool(settings.twogis_api_key)
    if settings.places_provider == "google":
        return bool(settings.google_places_key)
    return False


def fetch_place(name: str, city: str) -> PlaceInfo | None:
    """Look up a clinic on the configured official provider. None if disabled."""
    if not enabled():
        return None
    try:
        if settings.places_provider == "2gis":
            return _fetch_2gis(name, city)
        if settings.places_provider == "google":
            return _fetch_google(name, city)
    except Exception as exc:
        logger.warning("places lookup failed for %s (%s): %s", name, city, exc)
    return None


# --- 2GIS Catalog API (https://docs.2gis.com/en/api/search/places/overview) ---
def _fetch_2gis(name: str, city: str) -> PlaceInfo | None:
    url = "https://catalog.api.2gis.com/3.0/items"
    params = {
        "q": f"{name} {city}",
        "key": settings.twogis_api_key,
        "fields": "items.point,items.reviews,items.schedule,items.external_content,items.contact_groups",
        "page_size": 1,
    }
    with httpx.Client(timeout=15) as c:
        resp = c.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    items = (data.get("result") or {}).get("items") or []
    if not items:
        return None
    it = items[0]
    reviews = it.get("reviews") or {}
    point = it.get("point") or {}
    ext = it.get("external_content") or []
    photo = None
    for e in ext:
        if e.get("type") == "photo_album" and e.get("main_photo_url"):
            photo = e["main_photo_url"]
            break
    return PlaceInfo(
        place_id=str(it.get("id")),
        source="2gis",
        rating=reviews.get("general_rating"),
        reviews_count=reviews.get("general_review_count"),
        photo_url=photo,
        address=it.get("address_name") or it.get("full_name"),
        lat=point.get("lat"),
        lng=point.get("lon"),
        reviews=[],  # full review texts come from the 2GIS Reviews API (separate, optional)
    )


# --- Google Places API (Place Details) ---
def _fetch_google(name: str, city: str) -> PlaceInfo | None:
    find = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
    with httpx.Client(timeout=15) as c:
        r = c.get(find, params={
            "input": f"{name} {city}", "inputtype": "textquery",
            "fields": "place_id", "key": settings.google_places_key,
        })
        r.raise_for_status()
        cand = (r.json().get("candidates") or [])
        if not cand:
            return None
        place_id = cand[0]["place_id"]
        det = c.get("https://maps.googleapis.com/maps/api/place/details/json", params={
            "place_id": place_id,
            "fields": "rating,user_ratings_total,formatted_address,geometry,reviews,photos,opening_hours",
            "key": settings.google_places_key,
        })
        det.raise_for_status()
        res = det.json().get("result") or {}
    loc = (res.get("geometry") or {}).get("location") or {}
    reviews = [
        ReviewItem(
            external_id=f"{place_id}:{i}",
            rating=rv.get("rating"),
            text=rv.get("text"),
            author_alias=rv.get("author_name"),
            published_at=None,
        )
        for i, rv in enumerate((res.get("reviews") or [])[: settings.places_reviews_limit])
    ]
    return PlaceInfo(
        place_id=place_id,
        source="google",
        rating=res.get("rating"),
        reviews_count=res.get("user_ratings_total"),
        address=res.get("formatted_address"),
        lat=loc.get("lat"),
        lng=loc.get("lng"),
        working_hours="; ".join((res.get("opening_hours") or {}).get("weekday_text") or []) or None,
        reviews=reviews,
    )
