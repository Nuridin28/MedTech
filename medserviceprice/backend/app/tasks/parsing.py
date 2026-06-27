"""parse_source task — the real web-ingestion entrypoint (TZ §5–6).

fetch -> shared ingestion pipeline (app/services/ingest.py). Each source runs in
isolation so one failing source never blocks the others (TZ §2.2, §5.2).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.core.sync_db import SyncSession
from app.models import ParseLog
from app.parsers.registry import get_parser
from app.services.ingest import ingest_records, invalidate_cache

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.parsing.parse_source", bind=True, max_retries=2)
def parse_source(self, source_key: str) -> dict:
    started = datetime.now(timezone.utc)
    db: Session = SyncSession()
    status = "success"
    error_message: str | None = None
    counts = {"inserted": 0, "updated": 0, "unmatched": 0}

    try:
        parser = get_parser(source_key)
        records = parser.to_raw_records()
        if not records:
            status = "partial"
            error_message = "no records returned (blocked, empty, or unreachable)"

        counts = ingest_records(db, source_key, records, started)
        if counts.get("status") == "partial" and status == "success":
            status = "partial"
        db.commit()
    except Exception as exc:
        db.rollback()
        status = "failed"
        error_message = str(exc)
        logger.exception("[%s] parse failed", source_key)
    finally:
        records_count = counts.get("inserted", 0) + counts.get("updated", 0)
        db.add(
            ParseLog(
                source_key=source_key,
                status=status,
                records_count=records_count,
                error_message=error_message,
                started_at=started,
                finished_at=datetime.now(timezone.utc),
            )
        )
        db.commit()
        db.close()

    if status != "failed":
        invalidate_cache()

    return {
        "source": source_key,
        "status": status,
        "inserted": counts.get("inserted", 0),
        "updated": counts.get("updated", 0),
        "unmatched": counts.get("unmatched", 0),
        "error": error_message,
    }
