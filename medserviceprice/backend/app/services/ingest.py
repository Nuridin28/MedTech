"""Shared ingestion pipeline (TZ §5–6).

The per-record path — raw layer (dedup) → clinic upsert → normalize → offer upsert
(dedup) → price history — is identical whether records come from a web parser or
from an uploaded file. Both `tasks/parsing.py` (web) and `tasks/import_task.py`
(file upload) call `ingest_records()` so there is exactly one ingestion path.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import (
    Clinic,
    PriceHistory,
    RawRecord,
    ServiceCatalog,
    ServiceOffer,
    UnmatchedQueue,
)
from app.parsers.base import RawServiceRecord
from app.services.normalization import CatalogEntry, Normalizer

logger = logging.getLogger(__name__)


def load_normalizer(db: Session) -> Normalizer:
    rows = db.execute(select(ServiceCatalog)).scalars().all()
    entries = [
        CatalogEntry(id=r.id, name_norm=r.name_norm, category=r.category, synonyms=list(r.synonyms or []))
        for r in rows
    ]
    return Normalizer(entries)


def _get_or_create_clinic(db: Session, rec: RawServiceRecord, cache: dict) -> Clinic:
    key = (rec.clinic.name, rec.clinic.city)
    if key in cache:
        return cache[key]
    clinic = db.execute(
        select(Clinic).where(Clinic.name == rec.clinic.name, Clinic.city == rec.clinic.city)
    ).scalar_one_or_none()
    if clinic is None:
        clinic = Clinic(
            name=rec.clinic.name,
            city=rec.clinic.city,
            address=rec.clinic.address,
            phone=rec.clinic.phone,
            working_hours=rec.clinic.working_hours,
            source_url=rec.clinic.source_url,
            lat=rec.clinic.lat,
            lng=rec.clinic.lng,
            verified=True,  # came from an official public price list / file
        )
        db.add(clinic)
        db.flush()
    cache[key] = clinic
    return clinic


def _queue_unmatched(
    db: Session, rec: RawServiceRecord, source_key: str, suggested_id, score: float
) -> None:
    existing = db.execute(
        select(UnmatchedQueue.id).where(
            UnmatchedQueue.service_name_raw == rec.service_name_raw,
            UnmatchedQueue.source_key == source_key,
            UnmatchedQueue.status == "pending",
        )
    ).first()
    if existing is None:
        db.add(
            UnmatchedQueue(
                service_name_raw=rec.service_name_raw,
                source_key=source_key,
                suggested_id=suggested_id,
                match_score=score,
                status="pending",
            )
        )


def ingest_records(
    db: Session,
    source_key: str,
    records: list[RawServiceRecord],
    started: datetime | None = None,
) -> dict:
    """Run the full per-record pipeline. Adds rows to the session but does NOT
    commit — the caller owns the transaction. Returns counts + a status hint
    ('success' | 'partial')."""
    started = started or datetime.now(timezone.utc)
    normalizer = load_normalizer(db)
    clinic_cache: dict = {}
    inserted = updated = unmatched_count = 0
    status = "success"

    for rec in records:
        try:
            # 1) raw layer (dedup on content_hash) — TZ §4.1, §5.3
            chash = rec.content_hash()
            exists_raw = db.execute(
                select(RawRecord.id).where(
                    RawRecord.source_key == source_key, RawRecord.content_hash == chash
                )
            ).first()
            if exists_raw is None:
                db.add(
                    RawRecord(
                        source_key=source_key,
                        source_url=rec.source_url or (rec.clinic.source_url or ""),
                        raw_payload={
                            "name": rec.service_name_raw,
                            "price": rec.price,
                            "currency": rec.currency,
                            "duration_days": rec.duration_days,
                            "clinic": rec.clinic.name,
                            "city": rec.clinic.city,
                            **rec.extra,
                        },
                        content_hash=chash,
                    )
                )

            # 2) clinic upsert
            clinic = _get_or_create_clinic(db, rec, clinic_cache)

            # 3) normalize -> catalog
            match = normalizer.match(rec.service_name_raw)
            service_id = match.service_id if match.matched else None
            if not match.matched:
                _queue_unmatched(db, rec, source_key, match.service_id, match.score)
                unmatched_count += 1

            # 4) offer upsert (dedup on offer_hash) — TZ §5.3
            ohash = rec.offer_hash()
            offer = db.execute(
                select(ServiceOffer).where(
                    ServiceOffer.clinic_id == clinic.id, ServiceOffer.offer_hash == ohash
                )
            ).scalar_one_or_none()

            if offer is None:
                offer = ServiceOffer(
                    clinic_id=clinic.id,
                    service_id=service_id,
                    service_name_raw=rec.service_name_raw,
                    price_kzt=rec.price,
                    currency=rec.currency,
                    duration_days=rec.duration_days,
                    source_url=rec.source_url,
                    parsed_at=started,
                    is_active=True,
                    offer_hash=ohash,
                )
                db.add(offer)
                inserted += 1
            else:
                offer.price_kzt = rec.price
                offer.parsed_at = started
                offer.is_active = True
                offer.duration_days = rec.duration_days
                if service_id and offer.service_id is None:
                    offer.service_id = service_id
                updated += 1

            # 5) price history — append a point whenever the observed price for a
            #    normalized (service, clinic) differs from the latest stored point. TZ §4.3
            if service_id:
                last = db.execute(
                    select(PriceHistory.price_kzt)
                    .where(
                        PriceHistory.service_id == service_id,
                        PriceHistory.clinic_id == clinic.id,
                    )
                    .order_by(PriceHistory.recorded_at.desc())
                    .limit(1)
                ).scalar_one_or_none()
                if last is None or float(last) != float(rec.price):
                    db.add(
                        PriceHistory(
                            clinic_id=clinic.id,
                            service_id=service_id,
                            price_kzt=rec.price,
                            recorded_at=started,
                        )
                    )
        except Exception as row_exc:  # never let one bad row kill the batch
            logger.warning("[%s] row failed: %s", source_key, row_exc)
            status = "partial"

    return {
        "inserted": inserted,
        "updated": updated,
        "unmatched": unmatched_count,
        "status": status,
    }


def invalidate_cache() -> None:
    """Drop cached read responses so users see fresh data after an ingest."""
    try:
        r = redis.from_url(settings.redis_url, decode_responses=True)
        for pattern in ("offers:*", "ac:*", "clinic:*"):
            for k in r.scan_iter(match=pattern, count=200):
                r.delete(k)
    except Exception as exc:  # cache invalidation must never fail the task
        logger.warning("cache invalidation skipped: %s", exc)
