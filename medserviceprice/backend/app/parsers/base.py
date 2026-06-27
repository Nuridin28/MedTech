"""Parser base class — the adapter contract (TZ §5.1, §5.4).

Each source subclasses BaseParser and implements fetch() -> parse() -> to_raw_records().
A RawServiceRecord is the structurally-normalized-but-still-raw output that the
normalization stage (TZ §6) later maps to the catalog.
"""
from __future__ import annotations

import hashlib
import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class RawClinic:
    name: str
    city: str
    address: str | None = None
    phone: str | None = None
    working_hours: str | None = None
    source_url: str | None = None
    lat: float | None = None
    lng: float | None = None


@dataclass
class RawServiceRecord:
    """One scraped price line, before catalog normalization."""

    clinic: RawClinic
    service_name_raw: str
    price: float
    currency: str = "KZT"
    duration_days: int | None = None
    category_hint: str | None = None
    source_url: str | None = None
    extra: dict = field(default_factory=dict)
    #: optional cleaned name used for catalog matching only; service_name_raw stays
    #: verbatim for the raw layer / dedup / display fallback.
    match_name: str | None = None

    def content_hash(self) -> str:
        basis = f"{self.clinic.name}|{self.service_name_raw}|{self.price}|{self.currency}"
        return hashlib.sha256(basis.encode("utf-8")).hexdigest()

    def offer_hash(self) -> str:
        # TZ §5.3: sha256(clinic_name + service_name_raw + price)
        basis = f"{self.clinic.name}{self.service_name_raw}{self.price}"
        return hashlib.sha256(basis.encode("utf-8")).hexdigest()


class BaseParser(ABC):
    source_key: str = "base"
    #: Pages this parser will hit; concrete parsers usually build these dynamically.
    base_url: str = ""

    def __init__(self) -> None:
        self._robots: dict[str, RobotFileParser] = {}

    # --- contract ---------------------------------------------------------
    @abstractmethod
    def fetch(self) -> list[tuple[str, str]]:
        """Download source pages. Returns list of (url, html/text) tuples."""

    @abstractmethod
    def parse(self, pages: list[tuple[str, str]]) -> list[RawServiceRecord]:
        """Extract structured price lines from the fetched pages."""

    def to_raw_records(self) -> list[RawServiceRecord]:
        """fetch() -> parse() pipeline with isolation handled by the caller (Celery task)."""
        pages = self.fetch()
        return self.parse(pages)

    # --- shared HTTP helpers (etiquette per TZ §5.4) ----------------------
    def _allowed_by_robots(self, url: str) -> bool:
        parsed = urlparse(url)
        root = f"{parsed.scheme}://{parsed.netloc}"
        rp = self._robots.get(root)
        if rp is None:
            rp = RobotFileParser()
            # Fetch robots.txt with OUR polite UA via httpx (not RobotFileParser's
            # default Python-urllib UA, which anti-bot layers like Cloudflare 403 —
            # that would make us fail closed and ignore the source's REAL published
            # policy). We honor whatever the published robots.txt actually says.
            try:
                headers = {"User-Agent": settings.parser_user_agent, "Accept": "text/plain"}
                with httpx.Client(headers=headers, timeout=settings.parser_timeout_seconds) as c:
                    resp = c.get(f"{root}/robots.txt", follow_redirects=True)
                if resp.status_code == 200:
                    rp.parse(resp.text.splitlines())
                elif resp.status_code in (401, 403):
                    # Per RFC 9309: access-restricted robots ⇒ treat site as disallowed.
                    rp.disallow_all = True
                else:
                    # 404 / other ⇒ no restrictions published.
                    rp.allow_all = True
            except Exception:
                logger.warning("Could not read robots.txt for %s — proceeding politely", root)
                rp.allow_all = True
            self._robots[root] = rp
        return rp.can_fetch(settings.parser_user_agent, url)

    @retry(
        stop=stop_after_attempt(settings.parser_max_retries),
        wait=wait_exponential(multiplier=1, min=2, max=15),
        reraise=True,
    )
    def _http_get(self, url: str, client: httpx.Client) -> httpx.Response:
        resp = client.get(url, follow_redirects=True)
        resp.raise_for_status()
        return resp

    def get(self, url: str) -> str | None:
        """Polite GET: robots check + delay + retries. Returns text or None if blocked."""
        if not self._allowed_by_robots(url):
            logger.warning("[%s] blocked by robots.txt: %s", self.source_key, url)
            return None
        headers = {"User-Agent": settings.parser_user_agent, "Accept-Language": "ru,en"}
        with httpx.Client(
            headers=headers, timeout=settings.parser_timeout_seconds
        ) as client:
            resp = self._http_get(url, client)
        time.sleep(settings.parser_delay_seconds)  # rate-limit ourselves
        return resp.text
