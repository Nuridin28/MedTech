"""import_file task — ingest an uploaded price-list file (TZ §3.1).

Runs the uploaded Excel/CSV/PDF/DOCX through the same pipeline as web parsing, in
isolation: a malformed file fails only its own task and is logged to parse_logs.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.core.sync_db import SyncSession
from app.models import ParseLog
from app.parsers.file_source import FileSourceParser
from app.services.ingest import ingest_records, invalidate_cache

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.import_task.import_file", bind=True, max_retries=1)
def import_file(self, file_path: str, clinic_meta: dict, source_key: str) -> dict:
    started = datetime.now(timezone.utc)
    db: Session = SyncSession()
    status = "success"
    error_message: str | None = None
    counts = {"inserted": 0, "updated": 0, "unmatched": 0}

    try:
        parser = FileSourceParser(file_path=file_path, source_key=source_key, **clinic_meta)
        records = parser.to_raw_records()
        if not records:
            status = "partial"
            error_message = "no price rows extracted from file (unrecognised layout?)"
        counts = ingest_records(db, source_key, records, started)
        if counts.get("status") == "partial" and status == "success":
            status = "partial"
        db.commit()
    except Exception as exc:
        db.rollback()
        status = "failed"
        error_message = str(exc)
        logger.exception("[%s] file import failed", source_key)
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
        try:
            from app.services.alerts import evaluate_parse_outcome

            evaluate_parse_outcome(db, source_key, status, records_count)
        except Exception:
            logger.exception("[%s] alert evaluation failed", source_key)
        db.commit()
        db.close()

    if status != "failed":
        invalidate_cache()

    return {"source": source_key, "status": status, **counts, "error": error_message}
