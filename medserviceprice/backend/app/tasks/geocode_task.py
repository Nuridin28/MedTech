"""geocode_clinics task (TZ §3.4) — fill lat/lng for clinics missing coordinates."""
from __future__ import annotations

import logging

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.core.sync_db import SyncSession
from app.models import Clinic
from app.services.geocode import geocode

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.geocode_task.geocode_clinics")
def geocode_clinics(limit: int = 50) -> dict:
    db: Session = SyncSession()
    updated = 0
    try:
        clinics = db.execute(
            select(Clinic).where(or_(Clinic.lat.is_(None), Clinic.lng.is_(None))).limit(limit)
        ).scalars().all()
        for clinic in clinics:
            coords = geocode(clinic.address, clinic.city)
            if coords:
                clinic.lat, clinic.lng = coords
                updated += 1
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("geocode_clinics failed")
    finally:
        db.close()
    logger.info("geocode_clinics: updated=%d", updated)
    return {"updated": updated}
