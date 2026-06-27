"""notify_price_drops task (TZ §3.4) — alert subscribers when a tracked price falls.

For each active subscription, compute the current lowest active price for the
service (optionally pinned to a clinic). If it dropped below the last price we
notified about (or below the price at subscription time), send a notification and
remember the new floor so we don't re-alert on the same drop.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.core.sync_db import SyncSession
from app.models import ServiceCatalog, ServiceOffer, Subscription
from app.services.notify import send_email

logger = logging.getLogger(__name__)


def _current_min(db: Session, service_id, clinic_id) -> tuple[float | None, str | None]:
    stmt = (
        select(func.min(ServiceOffer.price_kzt))
        .where(ServiceOffer.service_id == service_id, ServiceOffer.is_active.is_(True))
    )
    if clinic_id:
        stmt = stmt.where(ServiceOffer.clinic_id == clinic_id)
    price = db.execute(stmt).scalar_one_or_none()
    name = db.execute(
        select(ServiceCatalog.name_norm).where(ServiceCatalog.id == service_id)
    ).scalar_one_or_none()
    return (float(price) if price is not None else None, name)


@celery_app.task(name="app.tasks.subscriptions_task.notify_price_drops")
def notify_price_drops() -> dict:
    db: Session = SyncSession()
    sent = checked = 0
    try:
        subs = db.execute(select(Subscription)).scalars().all()
        for sub in subs:
            checked += 1
            current, name = _current_min(db, sub.service_id, sub.clinic_id)
            if current is None:
                continue
            baseline = (
                float(sub.notified_price_kzt)
                if sub.notified_price_kzt is not None
                else None
            )
            # First observation: record the floor silently (no alert on signup).
            if baseline is None:
                sub.notified_price_kzt = current
                sub.last_notified_at = datetime.now(timezone.utc)
                continue
            if current < baseline:
                drop = baseline - current
                pct = round(drop / baseline * 100, 1)
                ok = send_email(
                    to=sub.email,
                    subject=f"Цена снизилась: {name or 'услуга'} — теперь от {current:,.0f} ₸".replace(",", " "),
                    body=(
                        f"Отслеживаемая вами услуга «{name or sub.service_id}» подешевела.\n"
                        f"Было: {baseline:,.0f} ₸  →  стало: {current:,.0f} ₸ "
                        f"(−{drop:,.0f} ₸, −{pct}%).\n\n"
                        f"Смотреть предложения: https://medserviceprice.kz/service/{sub.service_id}"
                    ).replace(",", " "),
                )
                if ok:
                    sub.notified_price_kzt = current
                    sub.last_notified_at = datetime.now(timezone.utc)
                    sent += 1
            elif current > baseline:
                # Price rose — raise the floor so a future dip re-triggers correctly.
                sub.notified_price_kzt = current
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("notify_price_drops failed")
    finally:
        db.close()
    logger.info("notify_price_drops: checked=%d sent=%d", checked, sent)
    return {"checked": checked, "sent": sent}
