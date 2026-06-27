"""Seed the services_catalog with normalized reference positions (TZ §6.2, §15).

Idempotent: safe to run repeatedly. Run after `alembic upgrade head`:
    python -m scripts.seed_catalog
"""
from __future__ import annotations

import logging

from sqlalchemy import select, text

from app.core.sync_db import SyncSession, sync_engine
from app.data_catalog import CATALOG
from app.models import ServiceCatalog

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")


def ensure_extensions() -> None:
    with sync_engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))


def seed() -> int:
    db = SyncSession()
    added = 0
    try:
        existing = {r for (r,) in db.execute(select(ServiceCatalog.name_norm)).all()}
        for name_norm, category, synonyms in CATALOG:
            if name_norm in existing:
                continue
            db.add(ServiceCatalog(name_norm=name_norm, category=category, synonyms=synonyms))
            added += 1
        db.commit()
        total = db.execute(select(ServiceCatalog)).scalars().all()
        logger.info("Catalog seeded: +%d new, %d total positions", added, len(total))
        return added
    finally:
        db.close()


if __name__ == "__main__":
    ensure_extensions()
    seed()
