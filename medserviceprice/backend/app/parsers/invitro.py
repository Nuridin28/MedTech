"""Invitro Kazakhstan parser (invitro.kz) — REAL source, multi-city.

The `/analizes/for-doctors/{city}/` catalog is server-rendered (Bitrix) with prices
inline, so plain httpx + BeautifulSoup works — no Playwright. Each city path renders
that city's own prices (verified: Astana/Shymkent prices differ from Almaty); the
empty path is Invitro's default city, Almaty.

Card structure (verified, identical across cities):
  div.item_card
      .analyzes-item__title            -> service name (raw, incl. English synonyms)
      a[href*="/analizes/"]            -> source URL
      .analyzes-item__total--price     -> e.g. "8 400 ₸"
"""
from __future__ import annotations

import logging
import re

from bs4 import BeautifulSoup

from app.parsers.base import BaseParser, RawClinic, RawServiceRecord

logger = logging.getLogger(__name__)

_DIGITS = re.compile(r"\d[\d\s ]*")
_DURATION = re.compile(r"(\d+)\s*(?:к\.?\s?д|рабоч|дн)", re.IGNORECASE)

# slug -> (display city, URL path segment). Almaty is Invitro's default (empty path).
INVITRO_CITIES: dict[str, tuple[str, str]] = {
    "almaty": ("Almaty", ""),
    "astana": ("Astana", "astana/"),
    "shymkent": ("Shymkent", "shymkent/"),
}


class InvitroParser(BaseParser):
    source_key = "invitro"
    base_url = "https://invitro.kz"

    def __init__(self, city: str = "almaty") -> None:
        super().__init__()
        if city not in INVITRO_CITIES:
            raise ValueError(f"Unknown Invitro city slug: {city}")
        self.city_slug = city
        self.city_name, self.city_path = INVITRO_CITIES[city]

    def fetch(self) -> list[tuple[str, str]]:
        url = f"{self.base_url}/analizes/for-doctors/{self.city_path}"
        html = self.get(url)
        if not html:
            logger.warning("[invitro] no HTML for %s", url)
            return []
        return [(url, html)]

    def parse(self, pages: list[tuple[str, str]]) -> list[RawServiceRecord]:
        records: list[RawServiceRecord] = []
        clinic = RawClinic(
            name=f"Invitro ({self.city_name})",
            city=self.city_name,
            source_url=f"{self.base_url}/analizes/for-doctors/{self.city_path}",
            working_hours="Mon–Sun 07:00–19:00",
        )

        for _, html in pages:
            soup = BeautifulSoup(html, "lxml")
            for card in soup.select("div.item_card"):
                title_el = card.select_one(".analyzes-item__title")
                price_el = card.select_one(".analyzes-item__total--price")
                if not title_el or not price_el:
                    continue
                name = title_el.get_text(" ", strip=True)
                price = self._price(price_el.get_text())
                if not name or price is None:
                    continue

                a = card.select_one('a[href*="/analizes/"]')
                href = a.get("href") if a else ""
                source_url = href if href.startswith("http") else f"{self.base_url}{href}"

                card_text = card.get_text(" ", strip=True)
                m = _DURATION.search(card_text)
                duration = int(m.group(1)) if m else None

                records.append(
                    RawServiceRecord(
                        clinic=clinic,
                        service_name_raw=name,
                        match_name=self._clean_name(name),
                        price=price,
                        currency="KZT",
                        duration_days=duration,
                        category_hint="laboratory",  # Invitro's catalog is lab-dominant
                        source_url=source_url,
                    )
                )

        # de-dup identical (name, price) cards that Bitrix renders more than once
        seen: set[tuple[str, float]] = set()
        unique: list[RawServiceRecord] = []
        for r in records:
            key = (r.service_name_raw, r.price)
            if key in seen:
                continue
            seen.add(key)
            unique.append(r)

        logger.info("[invitro] %s: parsed %d unique price lines", self.city_name, len(unique))
        return unique

    @staticmethod
    def _price(text: str) -> float | None:
        cleaned = text.replace(" ", " ").strip()
        m = _DIGITS.search(cleaned)
        if not m:
            return None
        digits = re.sub(r"\D", "", m.group())
        return float(digits) if digits else None

    @staticmethod
    def _clean_name(name: str) -> str:
        """Strip Invitro's verbose tails so fuzzy matching to the catalog works:
        - drop parenthetical groups that contain Latin letters (English translations),
        - drop a leading generic "Анализ крови./мочи." prefix,
        - collapse whitespace.
        e.g. 'Анализ крови. Общий анализ крови (без ...) (Complete Blood Count, CBC)'
             -> 'Общий анализ крови'
        """
        n = re.sub(r"\([^)]*[A-Za-z][^)]*\)", " ", name)          # english parentheticals
        n = re.sub(r"^\s*Анализ\s+(?:крови|мочи|кала)\.\s*", "", n, flags=re.IGNORECASE)
        n = re.sub(r"\s+", " ", n).strip(" .,;")
        return n or name
