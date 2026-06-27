"""check_source_health — flag sources that stopped parsing successfully.

Complements the immediate parse-outcome alerts: if a source silently stops running
(beat misfire, persistent block), this periodic check raises a source_stale alert.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.core.config import settings
from app.core.sync_db import SyncSession
from app.models import ParseLog
from app.parsers.registry import all_source_keys
from app.services.alerts import raise_alert

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.health_task.check_source_health")
def check_source_health() -> dict:
    db: Session = SyncSession()
    flagged = 0
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.source_stale_hours)
        for key in all_source_keys():
            last_ok = db.execute(
                select(ParseLog.finished_at)
                .where(ParseLog.source_key == key, ParseLog.status.in_(["success", "partial"]))
                .order_by(ParseLog.finished_at.desc())
                .limit(1)
            ).scalar_one_or_none()
            if last_ok is None:
                continue  # never parsed yet (fresh install) — not "stale", skip the noise
            la = last_ok if last_ok.tzinfo else last_ok.replace(tzinfo=timezone.utc)
            if la < cutoff:
                hrs = int((datetime.now(timezone.utc) - la).total_seconds() // 3600)
                raise_alert(
                    db, key, "source_stale",
                    f"Источник «{key}» не парсился успешно {hrs} ч "
                    f"(порог {settings.source_stale_hours} ч).",
                )
                flagged += 1
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("check_source_health failed")
    finally:
        db.close()
    logger.info("check_source_health: flagged=%d", flagged)
    return {"flagged": flagged}
