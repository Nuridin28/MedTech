"""KDL Olymp parser (kdlolymp.kz) — REAL source.

KDL exposes a clean JSON price API that the site itself calls:

    GET /api/analysis-data?per-page=100&lang=ru-RU&city_slug={city}&page={n}

It returns categories → analyses with a per-city price, duration and slug, plus
`_meta.pageCount` for pagination. `city_slug` fully controls the city (the price's
`city_id` differs per city), so no cookies/auth are needed — just our polite UA.
robots.txt does NOT disallow /api, so this stays within parser etiquette.

(Previously this parsed the server-rendered /pricelist HTML; the API is stabler.)
"""
from __future__ import annotations

import json
import logging
from urllib.parse import urlencode

from app.parsers.base import BaseParser, RawClinic, RawServiceRecord

logger = logging.getLogger(__name__)

_PER_PAGE = 100
_MAX_PAGES = 80  # safety cap against a runaway pagination loop

# KDL Olymp branch presence by city -> our normalized city name.
KDL_CITIES: dict[str, str] = {
    "astana": "Astana",
    "almaty": "Almaty",
    "shymkent": "Shymkent",
    "karaganda": "Karaganda",
    "aktobe": "Aktobe",
}

# Map KDL's Russian section titles onto our catalog categories (best-effort hint).
_CATEGORY_HINTS: dict[str, str] = {
    "гематолог": "laboratory",
    "биохим": "laboratory",
    "гормон": "laboratory",
    "иммун": "laboratory",
    "инфекц": "laboratory",
    "аллерг": "laboratory",
    "онкомарк": "laboratory",
    "коагул": "laboratory",
    "моч": "laboratory",
    "анализ": "laboratory",
    "профил": "laboratory",
    "узи": "diagnostics",
    "мрт": "diagnostics",
    "кт": "diagnostics",
    "рентген": "diagnostics",
    "диагност": "diagnostics",
    "функцион": "diagnostics",
    "прием": "doctor_visit",
    "приём": "doctor_visit",
    "консультац": "doctor_visit",
    "врач": "doctor_visit",
    "процедур": "procedure",
    "забор": "procedure",
}


class KDLParser(BaseParser):
    source_key = "kdl"
    base_url = "https://kdlolymp.kz"

    def __init__(self, city: str = "astana") -> None:
        super().__init__()
        if city not in KDL_CITIES:
            raise ValueError(f"Unknown KDL city slug: {city}")
        self.city_slug = city
        self.city_name = KDL_CITIES[city]

    def _page_url(self, page: int) -> str:
        qs = urlencode(
            {"per-page": _PER_PAGE, "lang": "ru-RU", "city_slug": self.city_slug, "page": page}
        )
        return f"{self.base_url}/api/analysis-data?{qs}"

    def fetch(self) -> list[tuple[str, str]]:
        """Page through the JSON API until pageCount is exhausted."""
        first_url = self._page_url(1)
        raw = self.get(first_url)
        if not raw:
            logger.warning("[kdl] no data for %s", first_url)
            return []
        pages: list[tuple[str, str]] = [(first_url, raw)]
        try:
            page_count = int(json.loads(raw).get("_meta", {}).get("pageCount", 1))
        except Exception:
            page_count = 1
        for page in range(2, min(page_count, _MAX_PAGES) + 1):
            url = self._page_url(page)
            body = self.get(url)
            if body:
                pages.append((url, body))
        logger.info("[kdl] %s: fetched %d API page(s)", self.city_name, len(pages))
        return pages

    def parse(self, pages: list[tuple[str, str]]) -> list[RawServiceRecord]:
        records: list[RawServiceRecord] = []
        clinic = RawClinic(
            name=f"KDL Olymp ({self.city_name})",
            city=self.city_name,
            source_url=f"{self.base_url}/pricelist/{self.city_slug}",
            working_hours="Mon–Sun 07:00–19:00",
        )

        for _url, body in pages:
            try:
                payload = json.loads(body)
            except Exception:
                logger.warning("[kdl] page is not valid JSON, skipping")
                continue

            for category in payload.get("data", []):
                section_title = (category.get("translation") or {}).get("title", "") or ""
                category_hint = self._category_for(section_title)

                for a in category.get("analysis", []):
                    if a.get("site_show") == 0:
                        continue  # not shown on the public price list
                    name = ((a.get("translation") or {}).get("title") or "").strip()
                    price_obj = a.get("price") or {}
                    price = price_obj.get("price")
                    if not name or not price:
                        continue  # no price for this city -> skip

                    slug = a.get("slug") or ""
                    source_url = f"{self.base_url}/services/{slug}" if slug else clinic.source_url

                    records.append(
                        RawServiceRecord(
                            clinic=clinic,
                            service_name_raw=name,
                            price=float(price),
                            currency="KZT",
                            duration_days=self._duration_days(price_obj),
                            category_hint=category_hint,
                            source_url=source_url,
                            extra={
                                "section": section_title,
                                "code": a.get("code"),
                                "out_id": a.get("out_id"),
                                "city_id": price_obj.get("city_id"),
                            },
                        )
                    )

        logger.info("[kdl] %s: parsed %d price lines", self.city_name, len(records))
        return records

    # --- helpers ----------------------------------------------------------
    @staticmethod
    def _duration_days(price_obj: dict) -> int | None:
        # duration_unit == 2 means calendar days on KDL; use the upper bound.
        if price_obj.get("duration_unit") == 2:
            d = price_obj.get("max_duration") or price_obj.get("min_duration")
            return int(d) if d else None
        return None

    @staticmethod
    def _category_for(title: str) -> str | None:
        low = title.lower()
        for needle, cat in _CATEGORY_HINTS.items():
            if needle in low:
                return cat
        return None
