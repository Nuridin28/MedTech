"""File-based source adapter (TZ §3.1 — PDF/DOCX/Excel/CSV support).

Lets a non-technical operator add a clinic by uploading its published price list
instead of writing a scraper. It is a `BaseParser` like any web source, so it flows
through the exact same ingestion pipeline (raw → normalize → offer → history).
Reachable web sources stay as their own parsers; this covers clinics that only
publish a file (or sites that block automated fetching).
"""
from __future__ import annotations

import logging

from app.parsers.base import BaseParser, RawClinic, RawServiceRecord
from app.services.file_extract import extract_price_rows

logger = logging.getLogger(__name__)


class FileSourceParser(BaseParser):
    base_url = "file://"

    def __init__(
        self,
        *,
        file_path: str,
        clinic_name: str,
        city: str,
        source_key: str = "file",
        address: str | None = None,
        phone: str | None = None,
        working_hours: str | None = None,
        source_url: str | None = None,
    ) -> None:
        super().__init__()
        self.source_key = source_key
        self.file_path = file_path
        self.clinic = RawClinic(
            name=clinic_name,
            city=city,
            address=address,
            phone=phone,
            working_hours=working_hours,
            source_url=source_url or f"file://{file_path}",
        )

    def fetch(self) -> list[tuple[str, str]]:
        # The file IS the source; reading happens in parse() via the extractor.
        return [(self.file_path, "")]

    def parse(self, pages: list[tuple[str, str]]) -> list[RawServiceRecord]:
        rows = extract_price_rows(self.file_path)
        records = [
            RawServiceRecord(
                clinic=self.clinic,
                service_name_raw=name,
                price=price,
                currency="KZT",
                duration_days=duration,
                source_url=self.clinic.source_url,
                extra={"ingest": "file", "file": self.file_path.rsplit("/", 1)[-1]},
            )
            for name, price, duration in rows
        ]
        logger.info("[%s] file %s -> %d records", self.source_key, self.file_path, len(records))
        return records
