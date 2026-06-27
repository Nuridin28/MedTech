"""AI normalization tasks: cluster unmatched names into catalog suggestions, and
re-normalize existing offers after the catalog grows (raises coverage)."""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.core.sync_db import SyncSession
from app.models import ServiceOffer, UnmatchedQueue
from app.services.ai_normalize import suggest_catalog
from app.services.ingest import invalidate_cache, load_normalizer

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.normalize_ai_task.ai_suggest_catalog")
def ai_suggest_catalog(batch: int = 120) -> dict:
    db: Session = SyncSession()
    try:
        return suggest_catalog(db, batch=batch)
    except Exception as exc:
        db.rollback()
        logger.exception("ai_suggest_catalog failed")
        return {"error": str(exc)}
    finally:
        db.close()


@celery_app.task(name="app.tasks.normalize_ai_task.renormalize_offers")
def renormalize_offers() -> dict:
    """Re-run the matcher over offers with no catalog link + the pending queue,
    so newly-approved catalog positions attach existing data."""
    db: Session = SyncSession()
    attached = resolved = 0
    try:
        normalizer = load_normalizer(db)

        offers = db.execute(
            select(ServiceOffer).where(ServiceOffer.service_id.is_(None))
        ).scalars().all()
        for o in offers:
            m = normalizer.match(o.service_name_raw)
            if m.matched:
                o.service_id = m.service_id
                attached += 1

        queue = db.execute(
            select(UnmatchedQueue).where(UnmatchedQueue.status == "pending")
        ).scalars().all()
        for item in queue:
            m = normalizer.match(item.service_name_raw)
            if m.matched:
                item.status = "resolved"
                item.suggested_id = m.service_id
                resolved += 1

        db.commit()
    except Exception:
        db.rollback()
        logger.exception("renormalize_offers failed")
    finally:
        db.close()
    invalidate_cache()
    logger.info("renormalize_offers: attached=%d resolved=%d", attached, resolved)
    return {"attached": attached, "resolved": resolved}
