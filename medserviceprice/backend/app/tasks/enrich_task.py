"""enrich_clinics task — fill clinic metadata, photos, ratings & reviews.

Two layers, both safe:
  1. Always: parse the clinic's OWN structured data (JSON-LD/OpenGraph) for
     address, phone, hours, geo, primary photo, socials. (clinic_enrich.py)
  2. If a Places provider is configured (off by default): pull official rating,
     review count, photo and reviews from 2GIS/Google. (places.py)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.core.sync_db import SyncSession
from app.models import Clinic, ClinicReview
from app.services import places
from app.services.clinic_enrich import enrich_from_url

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.enrich_task.enrich_clinics")
def enrich_clinics(only_missing: bool = True) -> dict:
    db: Session = SyncSession()
    enriched = reviews_added = 0
    try:
        clinics = db.execute(select(Clinic)).scalars().all()
        for c in clinics:
            changed = False

            # 1) Own-site structured data (free, safe)
            if c.source_url and (not only_missing or not c.address or not c.photo_url):
                meta = enrich_from_url(c.source_url)
                if not meta.is_empty():
                    if meta.address and not c.address:
                        c.address = meta.address
                    if meta.phone and not c.phone:
                        c.phone = meta.phone
                    if meta.working_hours and not c.working_hours:
                        c.working_hours = meta.working_hours
                    if meta.lat and c.lat is None:
                        c.lat, c.lng = meta.lat, meta.lng
                    if meta.photo_url and not c.photo_url:
                        c.photo_url = meta.photo_url
                    if meta.socials and not c.socials:
                        c.socials = meta.socials
                    if meta.rating is not None and c.rating is None:
                        c.rating = meta.rating
                        c.reviews_count = meta.reviews_count or c.reviews_count
                    changed = True

            # 2) Official Places API (ratings/reviews/photos) — only if enabled
            if places.enabled():
                info = places.fetch_place(c.name, c.city)
                if info:
                    c.rating = info.rating if info.rating is not None else c.rating
                    c.reviews_count = info.reviews_count or c.reviews_count
                    c.photo_url = c.photo_url or info.photo_url
                    c.address = c.address or info.address
                    c.working_hours = c.working_hours or info.working_hours
                    if info.lat and c.lat is None:
                        c.lat, c.lng = info.lat, info.lng
                    c.place_id, c.place_source = info.place_id, info.source
                    c.place_synced_at = datetime.now(timezone.utc)
                    changed = True
                    for rv in info.reviews:
                        exists = db.execute(
                            select(ClinicReview.id).where(
                                ClinicReview.source == info.source,
                                ClinicReview.external_id == rv.external_id,
                            )
                        ).first()
                        if exists is None:
                            db.add(ClinicReview(
                                clinic_id=c.id, source=info.source, external_id=rv.external_id,
                                author_alias=rv.author_alias, rating=rv.rating, text=rv.text,
                                url=rv.url,
                            ))
                            reviews_added += 1

            if changed:
                enriched += 1
        db.commit()
        logger.info("enrich_clinics: %d clinics enriched, %d reviews added", enriched, reviews_added)
        return {"enriched": enriched, "reviews_added": reviews_added, "places": places.enabled()}
    finally:
        db.close()
