"""KDL Olymp parser (kdlolymp.kz) — REAL source.

KDL serves a fully server-rendered price list at /pricelist/{city} with the price
embedded in the HTML, so plain httpx + BeautifulSoup is enough (no Playwright).

Row structure (verified):
  div.analyzes > div.header > h2            -> category section title
  a.analysis[href=/services/{slug}]
      .title                                -> service name (raw)
      .about .category                      -> category label
      .about .duration                      -> e.g. "1 день"
      .buy .price                           -> e.g. "3 980 ₸"
"""
from __future__ import annotations

import logging
import re

from bs4 import BeautifulSoup

from app.parsers.base import BaseParser, RawClinic, RawServiceRecord

logger = logging.getLogger(__name__)

_PRICE_RE = re.compile(r"[\d\s ]+")
_DURATION_RE = re.compile(r"(\d+)")

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

    def fetch(self) -> list[tuple[str, str]]:
        url = f"{self.base_url}/pricelist/{self.city_slug}"
        html = self.get(url)
        if not html:
            logger.warning("[kdl] no HTML for %s", url)
            return []
        return [(url, html)]

    def parse(self, pages: list[tuple[str, str]]) -> list[RawServiceRecord]:
        records: list[RawServiceRecord] = []
        clinic = RawClinic(
            name=f"KDL Olymp ({self.city_name})",
            city=self.city_name,
            source_url=f"{self.base_url}/pricelist/{self.city_slug}",
            working_hours="Mon–Sun 07:00–19:00",
        )

        for url, html in pages:
            soup = BeautifulSoup(html, "lxml")
            for section in soup.select("div.analyzes"):
                header = section.select_one(".header h2")
                section_title = header.get_text(strip=True) if header else ""
                category_hint = self._category_for(section_title)

                for a in section.select("a.analysis"):
                    title_el = a.select_one(".title")
                    price_el = a.select_one(".price")
                    if not title_el or not price_el:
                        continue
                    name = title_el.get_text(" ", strip=True)
                    price = self._parse_price(price_el.get_text())
                    if price is None or not name:
                        continue

                    dur_el = a.select_one(".duration")
                    duration = self._parse_duration(dur_el.get_text()) if dur_el else None

                    cat_el = a.select_one(".category")
                    cat_hint = (
                        self._category_for(cat_el.get_text(strip=True))
                        if cat_el
                        else category_hint
                    )

                    href = a.get("href") or ""
                    source_url = href if href.startswith("http") else f"{self.base_url}{href}"

                    records.append(
                        RawServiceRecord(
                            clinic=clinic,
                            service_name_raw=name,
                            price=price,
                            currency="KZT",
                            duration_days=duration,
                            category_hint=cat_hint,
                            source_url=source_url,
                            extra={"section": section_title},
                        )
                    )

        logger.info("[kdl] %s: parsed %d price lines", self.city_name, len(records))
        return records

    # --- helpers ----------------------------------------------------------
    @staticmethod
    def _parse_price(text: str) -> float | None:
        # "3 980 ₸ " / "3 980 ₸" -> 3980.0
        cleaned = text.replace(" ", " ").strip()
        m = _PRICE_RE.search(cleaned)
        if not m:
            return None
        digits = re.sub(r"\D", "", m.group())
        return float(digits) if digits else None

    @staticmethod
    def _parse_duration(text: str) -> int | None:
        m = _DURATION_RE.search(text or "")
        return int(m.group(1)) if m else None

    @staticmethod
    def _category_for(title: str) -> str | None:
        low = title.lower()
        for needle, cat in _CATEGORY_HINTS.items():
            if needle in low:
                return cat
        return None
