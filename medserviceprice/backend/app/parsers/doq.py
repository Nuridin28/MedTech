"""doq.kz parser — REAL source (public JSON API).

doq.kz is a doctor-appointment / diagnostics aggregator. Its public REST API
(`api.doq.kz`, used by the site itself) returns doctors with their clinic branches
(real per-branch address + coordinates) and services with prices. robots.txt only
disallows /appointments and /feedback — the API is open. This ONE source yields
many real clinics with addresses across 12 cities, covering doctor visits and
diagnostics (which the lab sources KDL/Invitro don't).

Shape (verified):
  /api/v1/doctors/?city={id}&expand=clinic_branches,services&limit=&offset=
    results[].clinic_branches[] -> { id, name, address, location{lat,lng}, phones }
    results[].services[]        -> { service{id,name,type}, clinic_branch, price,
                                     base_price, discount_price }
"""
from __future__ import annotations

import json
import logging
import time

import httpx

from app.core.config import settings
from app.parsers.base import BaseParser, RawClinic, RawServiceRecord

logger = logging.getLogger(__name__)

# our slug -> (doq city id, display city name)
DOQ_CITIES: dict[str, tuple[int, str]] = {
    "almaty": (3, "Almaty"),
    "astana": (1, "Astana"),
    "shymkent": (5, "Shymkent"),
    "karaganda": (4, "Karaganda"),
    "aktobe": (10, "Aktobe"),
    "taraz": (13, "Taraz"),
}

# doq service "type" -> our catalog category (best-effort hint)
_TYPE_CATEGORY = {
    "procedure": "procedure",
    "analysis": "laboratory",
    "laboratory": "laboratory",
    "reception": "doctor_visit",
    "consultation": "doctor_visit",
    "diagnostics": "diagnostics",
}

PAGE_SIZE = 50
#: MVP cap so a run stays bounded (Almaty alone has ~2200 doctors). Raise/limit via
#: env later; the cap is logged, never silent.
MAX_DOCTORS_PER_CITY = 200


class DoqParser(BaseParser):
    source_key = "doq"
    base_url = "https://api.doq.kz"

    def __init__(self, city: str = "almaty") -> None:
        super().__init__()
        if city not in DOQ_CITIES:
            raise ValueError(f"Unknown doq city slug: {city}")
        self.city_slug = city
        self.city_id, self.city_name = DOQ_CITIES[city]

    def _headers(self) -> dict:
        return {
            "User-Agent": settings.parser_user_agent,
            "Accept": "application/json",
            "Accept-Language": "ru",
            "Origin": "https://doq.kz",
            "Referer": "https://doq.kz/",
        }

    def fetch(self) -> list[tuple[str, str]]:
        if not self._allowed_by_robots(f"{self.base_url}/api/v1/doctors/"):
            logger.warning("[doq] blocked by robots.txt")
            return []
        pages: list[tuple[str, str]] = []
        offset = 0
        with httpx.Client(headers=self._headers(), timeout=settings.parser_timeout_seconds) as client:
            while offset < MAX_DOCTORS_PER_CITY:
                url = (
                    f"{self.base_url}/api/v1/doctors/?city={self.city_id}"
                    f"&expand=clinic_branches,services&limit={PAGE_SIZE}&offset={offset}"
                )
                try:
                    resp = client.get(url)
                    resp.raise_for_status()
                except Exception as exc:
                    logger.warning("[doq] %s page failed: %s", self.city_name, exc)
                    break
                pages.append((url, resp.text))
                data = resp.json()
                if not data.get("next") or not data.get("results"):
                    break
                offset += PAGE_SIZE
                time.sleep(settings.parser_delay_seconds)  # polite
        logger.info("[doq] %s: fetched %d pages (cap %d)", self.city_name, len(pages), MAX_DOCTORS_PER_CITY)
        return pages

    def parse(self, pages: list[tuple[str, str]]) -> list[RawServiceRecord]:
        records: list[RawServiceRecord] = []
        for url, text in pages:
            try:
                data = json.loads(text)
            except Exception:
                continue
            for doc in data.get("results", []):
                branches = {b["id"]: b for b in (doc.get("clinic_branches") or [])}
                for svc in doc.get("services") or []:
                    branch = branches.get(svc.get("clinic_branch"))
                    if not branch:
                        continue
                    service = svc.get("service") or {}
                    name = (service.get("name") or "").strip()
                    price = svc.get("discount_price") or svc.get("price") or svc.get("base_price")
                    if not name or not price:
                        continue
                    loc = branch.get("location") or {}
                    phones = branch.get("phones") or []
                    cat = _TYPE_CATEGORY.get((service.get("type") or "").lower())
                    # Canonical doq.kz clinic page (verified via sitemap-clinics.xml):
                    #   https://doq.kz/clinics/{city_slug}/{clinic_slug}
                    # NOTE: path is /clinics/{city}/{slug}, not /{city}/clinics/{slug}.
                    clinic_slug = (branch.get("clinic_slug") or "").strip()
                    clinic_url = (
                        f"https://doq.kz/clinics/{self.city_slug}/{clinic_slug}"
                        if clinic_slug
                        else None
                    )
                    # doq publishes a 0..10 feedback score + count per branch.
                    fb_score = branch.get("feedback_score")
                    rating = round(float(fb_score) / 2, 1) if fb_score else None  # → 0..5
                    clinic = RawClinic(
                        name=branch.get("name") or "doq clinic",
                        city=self.city_name,
                        address=branch.get("address"),
                        phone=phones[0] if phones else branch.get("direct_call_phone"),
                        lat=loc.get("lat"),
                        lng=loc.get("lng"),
                        source_url=clinic_url,
                        rating=rating,
                        reviews_count=int(branch.get("feedback_count") or 0),
                        has_online_booking=True,  # doq.kz clinics accept online booking
                    )
                    records.append(
                        RawServiceRecord(
                            clinic=clinic,
                            service_name_raw=name,
                            price=float(price),
                            currency="KZT",
                            category_hint=cat,
                            # Show the human clinic page as the offer source, not the API URL.
                            source_url=clinic_url or url,
                            extra={"doq_service_id": service.get("id"), "type": service.get("type")},
                        )
                    )
        # de-dup identical (clinic, name, price) lines within the batch
        seen: set[tuple] = set()
        unique: list[RawServiceRecord] = []
        for r in records:
            key = (r.clinic.name, r.service_name_raw, r.price)
            if key in seen:
                continue
            seen.add(key)
            unique.append(r)
        logger.info("[doq] %s: %d price lines (%d unique)", self.city_name, len(records), len(unique))
        return unique
