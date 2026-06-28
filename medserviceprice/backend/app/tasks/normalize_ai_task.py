"""AI normalization tasks: cluster unmatched names into catalog suggestions, and
re-normalize existing offers after the catalog grows (raises coverage)."""
from __future__ import annotations

import logging

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.core.sync_db import SyncSession
from app.models import CatalogSuggestion, ServiceCatalog, ServiceOffer, UnmatchedQueue
from app.services.ai_normalize import suggest_catalog
from app.services.ingest import invalidate_cache, load_normalizer

logger = logging.getLogger(__name__)


def _pending_queue_count(db: Session) -> int:
    return db.execute(
        select(func.count()).select_from(UnmatchedQueue).where(UnmatchedQueue.status == "pending")
    ).scalar() or 0


def _apply_suggestion(db: Session, sug: CatalogSuggestion) -> int:
    """Sync mirror of the admin apply route: create/extend the catalog position and
    attach the offers carrying its synonyms. Returns offers attached."""
    svc = db.execute(
        select(ServiceCatalog).where(ServiceCatalog.name_norm == sug.proposed_name_norm)
    ).scalar_one_or_none()
    if svc is None:
        svc = ServiceCatalog(
            name_norm=sug.proposed_name_norm, category=sug.category, synonyms=list(sug.synonyms or [])
        )
        db.add(svc)
        db.flush()
    else:
        svc.synonyms = list({*(svc.synonyms or []), *(sug.synonyms or [])})

    syns = list(sug.synonyms or [])
    res = db.execute(
        update(ServiceOffer)
        .where(ServiceOffer.service_name_raw.in_(syns), ServiceOffer.service_id.is_(None))
        .values(service_id=svc.id)
    )
    db.execute(
        update(UnmatchedQueue)
        .where(UnmatchedQueue.service_name_raw.in_(syns), UnmatchedQueue.status == "pending")
        .values(status="resolved", suggested_id=svc.id)
    )
    sug.status = "applied"
    sug.applied_service_id = svc.id
    return res.rowcount or 0


@celery_app.task(name="app.tasks.normalize_ai_task.normalize_all")
def normalize_all(batch: int = 45, max_rounds: int = 250) -> dict:
    """Full auto-normalization: loop AI-suggest → auto-apply until the pending queue is
    drained. Each round drains its names out of the queue, so the next round advances to
    the tail. A round that makes no progress marks its (unclusterable) top names 'skipped'
    so the loop can't stall. Bypasses human review by design (user opted in)."""
    db: Session = SyncSession()
    rounds = suggested = applied = attached = skipped = 0
    try:
        while rounds < max_rounds:
            before = _pending_queue_count(db)
            if before == 0:
                break
            top_names = [
                r[0]
                for r in db.execute(
                    select(UnmatchedQueue.service_name_raw)
                    .where(UnmatchedQueue.status == "pending")
                    .group_by(UnmatchedQueue.service_name_raw)
                    .order_by(func.count(UnmatchedQueue.id).desc())
                    .limit(batch)
                ).all()
            ]
            try:
                res = suggest_catalog(db, batch=batch)
                suggested += int(res.get("suggested", 0))
            except Exception as exc:
                logger.warning("normalize_all: suggest failed (round %d): %s", rounds, exc)
                res = {}

            new_sugs = db.execute(
                select(CatalogSuggestion).where(CatalogSuggestion.status == "pending")
            ).scalars().all()
            for sug in new_sugs:
                attached += _apply_suggestion(db, sug)
                applied += 1
            db.commit()

            rounds += 1
            if _pending_queue_count(db) >= before:
                # No progress — these top names couldn't be clustered. Skip them so the
                # tail surfaces next round (prevents an infinite loop on stuck names).
                db.execute(
                    update(UnmatchedQueue)
                    .where(
                        UnmatchedQueue.service_name_raw.in_(top_names),
                        UnmatchedQueue.status == "pending",
                    )
                    .values(status="skipped")
                )
                db.commit()
                skipped += len(top_names)
            if rounds % 10 == 0:
                logger.info(
                    "normalize_all: round=%d applied=%d attached=%d pending=%d",
                    rounds, applied, attached, _pending_queue_count(db),
                )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("normalize_all failed")
    finally:
        db.close()
    invalidate_cache()
    logger.info(
        "normalize_all DONE: rounds=%d suggested=%d applied=%d attached=%d skipped=%d",
        rounds, suggested, applied, attached, skipped,
    )
    return {
        "rounds": rounds, "suggested": suggested, "applied": applied,
        "attached": attached, "skipped": skipped,
    }


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
