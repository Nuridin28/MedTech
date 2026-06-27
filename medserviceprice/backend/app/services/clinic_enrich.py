"""Clinic metadata enrichment from the clinic's OWN structured data.

Parses schema.org JSON-LD (Organization / MedicalBusiness / LocalBusiness) and
OpenGraph tags from a clinic page — data the site publishes *for machines*. This
is safe and license-clean (the clinic's own published info): address, phone,
hours, geo, primary photo, socials. Ratings/reviews come from the official Places
API path (`places.py`), never from scraping review platforms.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field

import httpx
from bs4 import BeautifulSoup

from app.core.config import settings

logger = logging.getLogger(__name__)

_BIZ_TYPES = {
    "Organization", "MedicalOrganization", "MedicalBusiness", "MedicalClinic",
    "LocalBusiness", "Hospital", "Physician", "DiagnosticLab",
}


@dataclass
class ClinicMeta:
    address: str | None = None
    phone: str | None = None
    working_hours: str | None = None
    lat: float | None = None
    lng: float | None = None
    photo_url: str | None = None
    rating: float | None = None
    reviews_count: int | None = None
    socials: list[str] = field(default_factory=list)

    def is_empty(self) -> bool:
        return not any(
            [self.address, self.phone, self.working_hours, self.lat, self.photo_url,
             self.rating, self.socials]
        )


def _iter_jsonld(soup: BeautifulSoup):
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = tag.string or tag.get_text() or ""
        try:
            data = json.loads(raw.strip())
        except Exception:
            continue
        items = data.get("@graph") if isinstance(data, dict) and "@graph" in data else data
        for it in items if isinstance(items, list) else [items]:
            if isinstance(it, dict):
                yield it


def _types(it: dict) -> set[str]:
    t = it.get("@type")
    return set(t) if isinstance(t, list) else {t} if t else set()


def _fmt_address(addr) -> str | None:
    if isinstance(addr, str):
        return addr.strip() or None
    if isinstance(addr, dict):
        parts = [addr.get("streetAddress"), addr.get("addressLocality"), addr.get("addressRegion")]
        joined = ", ".join(p for p in parts if p)
        return joined or None
    if isinstance(addr, list) and addr:
        return _fmt_address(addr[0])
    return None


def _fmt_hours(h) -> str | None:
    if isinstance(h, str):
        return h
    if isinstance(h, list):
        flat = [x if isinstance(x, str) else (x.get("dayOfWeek", "") if isinstance(x, dict) else "")
                for x in h]
        s = "; ".join(str(x) for x in flat if x)
        return s[:200] or None
    return None


def parse_meta(html: str, base_url: str) -> ClinicMeta:
    soup = BeautifulSoup(html, "lxml")
    meta = ClinicMeta()

    for it in _iter_jsonld(soup):
        if not (_types(it) & _BIZ_TYPES):
            continue
        meta.address = meta.address or _fmt_address(it.get("address"))
        if not meta.phone:
            tel = it.get("telephone") or (it.get("contactPoint") or {})
            if isinstance(tel, dict):
                tel = tel.get("telephone")
            if isinstance(tel, list):
                tel = next((t.get("telephone") if isinstance(t, dict) else t for t in tel), None)
            meta.phone = (tel or "").strip() or None if isinstance(tel, str) else meta.phone
        meta.working_hours = meta.working_hours or _fmt_hours(it.get("openingHours"))
        geo = it.get("geo") or {}
        if isinstance(geo, dict) and geo.get("latitude") and not meta.lat:
            try:
                meta.lat = float(geo["latitude"]); meta.lng = float(geo["longitude"])
            except (TypeError, ValueError):
                pass
        img = it.get("image") or it.get("logo")
        if isinstance(img, dict):
            img = img.get("url")
        if isinstance(img, list):
            img = next((x.get("url") if isinstance(x, dict) else x for x in img), None)
        if isinstance(img, str) and img.startswith("http") and not meta.photo_url:
            meta.photo_url = img
        rating = it.get("aggregateRating") or {}
        if isinstance(rating, dict) and rating.get("ratingValue") and meta.rating is None:
            try:
                meta.rating = float(rating["ratingValue"])
                rc = rating.get("reviewCount") or rating.get("ratingCount")
                meta.reviews_count = int(rc) if rc else None
            except (TypeError, ValueError):
                pass
        same = it.get("sameAs")
        if isinstance(same, list):
            meta.socials = [s for s in same if isinstance(s, str) and s.startswith("http")][:6]
        elif isinstance(same, str):
            meta.socials = [same]

    # OpenGraph fallback for the photo
    if not meta.photo_url:
        og = soup.find("meta", attrs={"property": "og:image"})
        url = og.get("content") if og else None
        if isinstance(url, str) and re.match(r"^https?://.+\.(jpg|jpeg|png|webp)", url, re.I):
            meta.photo_url = url
    return meta


def enrich_from_url(url: str) -> ClinicMeta:
    """Fetch a clinic page (its own site) and extract structured metadata."""
    headers = {"User-Agent": settings.parser_user_agent, "Accept-Language": "ru,en"}
    try:
        with httpx.Client(headers=headers, timeout=settings.parser_timeout_seconds) as c:
            resp = c.get(url, follow_redirects=True)
        if resp.status_code != 200:
            return ClinicMeta()
        return parse_meta(resp.text, url)
    except Exception as exc:
        logger.warning("clinic enrich failed for %s: %s", url, exc)
        return ClinicMeta()
