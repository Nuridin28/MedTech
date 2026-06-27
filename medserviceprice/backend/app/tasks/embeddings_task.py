"""Catalog embedding computation (TZ §6.3) — runs only when ENABLE_SEMANTIC=true."""
from __future__ import annotations

import logging

from sqlalchemy import select

from app.celery_app import celery_app
from app.core.config import settings
from app.core.sync_db import SyncSession
from app.models import ServiceCatalog

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.embeddings_task.refresh_embeddings")
def refresh_embeddings(only_missing: bool = True) -> dict:
    if not settings.enable_semantic:
        return {"skipped": "ENABLE_SEMANTIC is false"}

    from app.services.embeddings import embed_texts

    db = SyncSession()
    try:
        stmt = select(ServiceCatalog)
        if only_missing:
            stmt = stmt.where(ServiceCatalog.embedding.is_(None))
        rows = db.execute(stmt).scalars().all()
        if not rows:
            return {"updated": 0}

        # Embed name_norm + synonyms joined, so semantically-related queries match.
        texts = [", ".join([r.name_norm, *(r.synonyms or [])]) for r in rows]
        vectors = embed_texts(texts)
        for row, vec in zip(rows, vectors):
            row.embedding = vec
        db.commit()
        logger.info("Computed %d catalog embeddings", len(rows))
        return {"updated": len(rows)}
    finally:
        db.close()
