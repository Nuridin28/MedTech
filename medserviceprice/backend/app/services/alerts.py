"""Operational alerting (TZ §3.1 — error journaling, made actionable).

Raises an Alert when data collection goes wrong so source breakage is caught
before users see empty pages:
  * parse_failed — a source task ended with status='failed'
  * no_records   — a source ran but returned 0 rows (blocked / layout changed)
  * source_stale — a source hasn't parsed successfully in SOURCE_STALE_HOURS

Alerts are de-duplicated: while an unacknowledged alert of the same
(source_key, kind) exists, we refresh it instead of piling up duplicates. Each new
alert is also emailed (or logged when SMTP/ALERT_EMAIL is unset).
"""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Alert
from app.services.notify import send_email

logger = logging.getLogger(__name__)

_SEVERITY = {"parse_failed": "error", "no_records": "warning", "source_stale": "warning"}


def raise_alert(db: Session, source_key: str, kind: str, message: str) -> Alert | None:
    severity = _SEVERITY.get(kind, "warning")
    existing = db.execute(
        select(Alert).where(
            Alert.source_key == source_key,
            Alert.kind == kind,
            Alert.acknowledged.is_(False),
        )
    ).scalar_one_or_none()

    if existing is not None:
        # Same open issue — refresh it, don't spam a new row or a new email.
        existing.message = message
        from datetime import datetime, timezone

        existing.created_at = datetime.now(timezone.utc)
        logger.warning("[alert:%s] %s — %s (refreshed)", severity, source_key, message)
        return existing

    alert = Alert(source_key=source_key, severity=severity, kind=kind, message=message)
    db.add(alert)
    logger.warning("[alert:%s] %s — %s", severity, source_key, message)

    if settings.alert_email:
        send_email(
            to=settings.alert_email,
            subject=f"[MedServicePrice] {severity.upper()}: {source_key} — {kind}",
            body=message,
        )
    return alert


def evaluate_parse_outcome(
    db: Session, source_key: str, status: str, records_count: int
) -> None:
    """Called right after a parse/import task finishes (same session)."""
    if status == "failed":
        raise_alert(db, source_key, "parse_failed", f"Парсинг «{source_key}» упал (status=failed).")
    elif records_count == 0:
        raise_alert(
            db,
            source_key,
            "no_records",
            f"Источник «{source_key}» отработал, но вернул 0 записей "
            f"(возможна блокировка или смена вёрстки).",
        )
