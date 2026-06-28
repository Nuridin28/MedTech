"""Official Places API integration for ratings / reviews / photos.

Reviews, ratings and photos are sourced ONLY from an official API (2GIS Catalog,
or Google Places) — never scraped from maps (against their ToS) and never with
extra PII. OFF by default: with `PLACES_PROVIDER=none` or no API key, every call
is a safe no-op. Enable by setting PLACES_PROVIDER + the matching key.
"""
from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# City-name aliases as they appear in (Russian) place addresses. A returned place is
# accepted ONLY if its address mentions the requested city — otherwise providers tend
# to return the brand's flagship branch (e.g. a chain's HQ in Astana) for every city.
_CITY_ALIASES: dict[str, tuple[str, ...]] = {
    "Almaty": ("алматы", "almaty"),
    "Astana": ("астана", "нур-султан", "нур султан", "astana", "nur-sultan"),
    "Shymkent": ("шымкент", "shymkent"),
    "Karaganda": ("караганда", "қарағанды", "karaganda"),
    "Aktobe": ("актобе", "ақтөбе", "aktobe"),
    "Taraz": ("тараз", "taraz"),
    "Pavlodar": ("павлодар", "pavlodar"),
}


def _clean_name(name: str) -> str:
    """Drop a trailing "(City)" qualifier so the brand name searches cleanly."""
    return re.sub(r"\s*\([^)]*\)\s*", " ", name).strip()


def _matches_city(text: str | None, city: str) -> bool:
    """True if the address text plausibly belongs to the requested city. Unknown
    cities pass (we can't validate), so we only reject confirmed mismatches."""
    aliases = _CITY_ALIASES.get(city)
    if not aliases or not text:
        return True
    return any(a in text.lower() for a in aliases)


class PlacesRateLimited(Exception):
    """The provider rejected the call due to a daily/quota limit (HTTP 429).

    Distinct from a normal "not found" miss: the caller must NOT mark the clinic as
    synced, otherwise a transient quota blip would permanently lock it out of retries.
    """


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


def photo_enabled() -> bool:
    if settings.places_photo_provider == "google":
        return bool(settings.google_places_key)
    if settings.places_photo_provider == "2gis":
        return bool(settings.twogis_api_key)
    return False


def fetch_photo(name: str, city: str) -> str | None:
    """Photo-only lookup (e.g. Google for photos while 2GIS supplies ratings).
    Returns a stable image URL with no embedded key. None if disabled/not found."""
    if not photo_enabled():
        return None
    try:
        if settings.places_photo_provider == "google":
            return _google_photo(name, city)
        if settings.places_photo_provider == "2gis":
            info = _fetch_2gis(name, city)
            return info.photo_url if info else None
    except PlacesRateLimited:
        raise  # let the caller stop the run; don't swallow as a plain miss
    except Exception as exc:
        logger.warning("photo lookup failed for %s: %s", name, exc)
    return None


def _google_photo(name: str, city: str) -> str | None:
    """Photo via Places API (New): searchText -> place id -> Place Details photos.
    (Text Search does not return photos reliably; Place Details does.)"""
    place = _google_search_new(name, city, field_mask="places.id")
    if not place or not place.get("id"):
        return None
    return _google_resolve_photo(_google_place_photos(place["id"]))


def _google_place_photos(place_id: str) -> list:
    key = settings.google_places_key
    with httpx.Client(timeout=15) as c:
        for attempt in range(3):
            r = c.get(
                f"https://places.googleapis.com/v1/places/{place_id}",
                headers={"X-Goog-Api-Key": key, "X-Goog-FieldMask": "photos"},
            )
            if r.status_code == 200:
                return r.json().get("photos") or []
            if r.status_code == 429:  # per-minute quota — back off and retry
                time.sleep(2 * (attempt + 1))
                continue
            logger.warning("google place photos %s: %s %s", place_id, r.status_code, r.text[:120])
            return []
    return []


def _google_search_new(name: str, city: str, field_mask: str) -> dict | None:
    """Places API (New) Text Search — returns the first place or None."""
    key = settings.google_places_key
    with httpx.Client(timeout=15) as c:
        r = c.post(
            "https://places.googleapis.com/v1/places:searchText",
            headers={"X-Goog-Api-Key": key, "X-Goog-FieldMask": field_mask},
            json={"textQuery": f"{_clean_name(name)} {city}", "maxResultCount": 3,
                  "regionCode": "KZ", "languageCode": "ru"},
        )
        if r.status_code == 429:
            # Daily/quota limit — signal the caller to stop and retry later instead
            # of burning the per-clinic sync flag on an empty result.
            raise PlacesRateLimited(f"google searchText quota for {name}: {r.text[:160]}")
        if r.status_code != 200:
            logger.warning("google searchText %s: %s %s", name, r.status_code, r.text[:160])
            return None
        places_ = r.json().get("places") or []
        if not places_:
            return None
        # Prefer a result whose address matches the requested city (reject flagship
        # branches from another city). Falls back to first when no address is masked
        # in (e.g. photo-only lookups).
        for p in places_:
            if _matches_city(p.get("formattedAddress"), city):
                return p
        return places_[0]


def _google_resolve_photo(photos: list) -> str | None:
    if not photos or not photos[0].get("name"):
        return None
    key = settings.google_places_key
    with httpx.Client(timeout=15) as c:
        m = c.get(
            f"https://places.googleapis.com/v1/{photos[0]['name']}/media",
            params={"maxWidthPx": 800, "key": key, "skipHttpRedirect": "true"},
        )
        if m.status_code != 200:
            return None
        return m.json().get("photoUri")


def fetch_place(name: str, city: str) -> PlaceInfo | None:
    """Look up a clinic on the configured official provider. None if disabled."""
    if not enabled():
        return None
    try:
        if settings.places_provider == "2gis":
            return _fetch_2gis(name, city)
        if settings.places_provider == "google":
            return _fetch_google(name, city)
    except PlacesRateLimited:
        raise  # propagate so the caller stops and leaves the clinic unsynced
    except Exception as exc:
        logger.warning("places lookup failed for %s (%s): %s", name, city, exc)
    return None


# --- 2GIS Catalog API (https://docs.2gis.com/en/api/search/places/overview) ---
def _fetch_2gis(name: str, city: str) -> PlaceInfo | None:
    url = "https://catalog.api.2gis.com/3.0/items"
    params = {
        "q": f"{_clean_name(name)} {city}",
        "key": settings.twogis_api_key,
        "fields": "items.point,items.reviews,items.schedule,items.external_content,items.contact_groups,items.adm_div",
        "page_size": 5,  # fetch a few, then keep the one in the right city
    }
    with httpx.Client(timeout=15) as c:
        resp = c.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    items = (data.get("result") or {}).get("items") or []
    if not items:
        return None
    # Pick the first result whose address/admin-division matches the requested city;
    # reject brand-flagship hits from another city (the address↔city bug).
    it = None
    for cand in items:
        adm = " ".join(d.get("name", "") for d in (cand.get("adm_div") or []))
        addr_text = f"{cand.get('address_name') or ''} {cand.get('full_name') or ''} {adm}"
        if _matches_city(addr_text, city):
            it = cand
            break
    if it is None:
        logger.info("2gis: no result in city %s for %r — skipping", city, _clean_name(name))
        return None
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


# --- Google Places API (New) — one Text Search returns it all ---
def _fetch_google(name: str, city: str) -> PlaceInfo | None:
    mask = (
        "places.id,places.displayName,places.rating,places.userRatingCount,"
        "places.formattedAddress,places.location,places.photos"
    )
    if settings.places_reviews_limit > 0:
        mask += ",places.reviews"
    place = _google_search_new(name, city, field_mask=mask)
    if not place:
        return None
    if not _matches_city(place.get("formattedAddress"), city):
        logger.info("google: result not in city %s for %r — skipping", city, _clean_name(name))
        return None
    loc = place.get("location") or {}
    pid = place.get("id", "")
    reviews = [
        ReviewItem(
            external_id=f"{pid}:{i}",
            rating=rv.get("rating"),
            text=(rv.get("text") or {}).get("text"),
            author_alias=(rv.get("authorAttribution") or {}).get("displayName"),
            published_at=rv.get("publishTime"),
        )
        for i, rv in enumerate((place.get("reviews") or [])[: settings.places_reviews_limit])
    ]
    return PlaceInfo(
        place_id=pid,
        source="google",
        rating=place.get("rating"),
        reviews_count=place.get("userRatingCount"),
        photo_url=_google_resolve_photo(_google_place_photos(pid)),
        address=place.get("formattedAddress"),
        lat=loc.get("latitude"),
        lng=loc.get("longitude"),
        reviews=reviews,
    )
