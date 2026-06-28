"""enrich_clinics task — fill clinic metadata, photos, ratings & reviews.

Two layers, both safe:
  1. Always: parse the clinic's OWN structured data (JSON-LD/OpenGraph) for
     address, phone, hours, geo, primary photo, socials. (clinic_enrich.py)
  2. If a Places provider is configured (off by default): pull official rating,
     review count, photo and reviews from 2GIS/Google. (places.py)
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from sqlalchemy import func

from app.celery_app import celery_app
from app.core.config import settings
from app.core.sync_db import SyncSession
from app.models import Clinic, ClinicReview, ServiceOffer
from app.services import places
from app.services.clinic_enrich import enrich_from_url

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.enrich_task.enrich_clinics")
def enrich_clinics(only_missing: bool = True) -> dict:
    db: Session = SyncSession()
    enriched = reviews_added = places_calls = 0
    try:
        # --- 1) Free, safe own-site enrichment (no quota) for every clinic ---
        for c in db.execute(select(Clinic)).scalars().all():
            if not c.source_url or (only_missing and c.address and c.photo_url):
                continue
            meta = enrich_from_url(c.source_url)
            if meta.is_empty():
                continue
            # Multi-branch sites embed ONE HQ address in JSON-LD on every city page
            # (e.g. KDL's Astana HQ on the Almaty page). Only apply address/coords when
            # they belong to this clinic's city — otherwise skip (no wrong-city data).
            addr_ok = places._matches_city(meta.address, c.city)
            if meta.address and not c.address and addr_ok:
                c.address = meta.address
            if meta.phone and not c.phone:
                c.phone = meta.phone
            if meta.working_hours and not c.working_hours:
                c.working_hours = meta.working_hours
            if meta.lat and c.lat is None and addr_ok:
                c.lat, c.lng = meta.lat, meta.lng
            if meta.photo_url and not c.photo_url:
                c.photo_url = meta.photo_url
            if meta.socials and not c.socials:
                c.socials = meta.socials
            if meta.rating is not None and c.rating is None:
                c.rating = meta.rating
                c.reviews_count = meta.reviews_count or c.reviews_count
            enriched += 1

        # --- 2) Budgeted official Places API (ratings/reviews/photos) ---
        # Each clinic is looked up AT MOST ONCE ever (place_synced_at is stamped on
        # hit OR miss). Lifetime budget + per-run cap protect the 1000-request quota.
        if places.enabled() or places.photo_enabled():
            used = db.execute(
                select(func.count(Clinic.id)).where(Clinic.place_synced_at.is_not(None))
            ).scalar() or 0
            budget_left = max(0, settings.places_budget - used)
            run_left = min(settings.places_max_per_run, budget_left)

            if run_left > 0:
                offer_count = (
                    select(func.count(ServiceOffer.id))
                    .where(ServiceOffer.clinic_id == Clinic.id, ServiceOffer.is_active.is_(True))
                    .scalar_subquery()
                )
                # Never-synced clinics, most-visible (most offers) first.
                targets = db.execute(
                    select(Clinic)
                    .where(Clinic.place_synced_at.is_(None))
                    .order_by(offer_count.desc())
                    .limit(run_left)
                ).scalars().all()

                for c in targets:
                    # don't re-spend the main provider's quota if rating already set
                    attempt_provider = places.enabled() and c.rating is None
                    try:
                        info = places.fetch_place(c.name, c.city) if attempt_provider else None
                        if attempt_provider:
                            places_calls += 1
                        # photo from a dedicated photo provider (e.g. Google) if still missing
                        photo = (
                            places.fetch_photo(c.name, c.city)
                            if (not c.photo_url and places.photo_enabled())
                            else None
                        )
                    except places.PlacesRateLimited as exc:
                        # Daily quota hit — stop now, leave this and remaining clinics
                        # UNSYNCED so they retry once quota is back. Nothing is lost.
                        logger.warning("enrich_clinics: provider quota reached, stopping: %s", exc)
                        break
                    c.place_synced_at = datetime.now(timezone.utc)  # stamp only after a real response/miss
                    if photo:
                        c.photo_url = photo
                    time.sleep(0.3)  # spread calls to respect per-minute API quotas
                    if info:
                        c.rating = info.rating if info.rating is not None else c.rating
                        c.reviews_count = info.reviews_count or c.reviews_count
                        c.photo_url = c.photo_url or info.photo_url
                        c.address = c.address or info.address
                        c.working_hours = c.working_hours or info.working_hours
                        if info.lat and c.lat is None:
                            c.lat, c.lng = info.lat, info.lng
                        c.place_id, c.place_source = info.place_id, info.source
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
            logger.info(
                "places: used=%d budget=%d calls_this_run=%d", used, settings.places_budget, places_calls
            )

        db.commit()
        # drop cached clinic responses so enriched data (photo/rating/reviews) shows
        from app.services.ingest import invalidate_cache
        invalidate_cache()
        remaining = max(0, settings.places_budget - (used + places_calls)) if places.enabled() else None
        logger.info("enrich_clinics: %d enriched, %d reviews, %d places calls", enriched, reviews_added, places_calls)
        return {
            "enriched": enriched,
            "reviews_added": reviews_added,
            "places_calls": places_calls,
            "places_budget_remaining": remaining,
        }
    finally:
        db.close()
