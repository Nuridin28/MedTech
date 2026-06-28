"""AI-assisted catalog expansion (raises normalization coverage).

The unmatched queue holds the real service names clinics publish that didn't match
our small catalog. This module sends a batch of them to an LLM, which clusters them
into canonical catalog positions (name_norm + category + the raw synonyms each
covers). The result is stored as CatalogSuggestion rows — an analyst APPROVES them
in the admin panel before they become real catalog entries (human-in-the-loop).

Requires OPENAI_API_KEY. Sync (runs in a Celery worker).
"""
from __future__ import annotations

import json
import logging

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import CatalogSuggestion, ServiceCatalog, UnmatchedQueue
from app.services.normalization import normalize_string

logger = logging.getLogger(__name__)

CATEGORIES = {"laboratory", "doctor_visit", "diagnostics", "procedure"}

_SYSTEM = (
    "Ты — медицинский редактор-нормализатор каталога услуг (Казахстан). "
    "Тебе дают список «сырых» названий услуг с сайтов клиник, которые не привязались "
    "к справочнику. Сгруппируй их в КАНОНИЧЕСКИЕ позиции каталога. "
    "Для каждой позиции верни: name_norm (короткое каноническое русское название), "
    "category (строго одно из: laboratory, doctor_visit, diagnostics, procedure), "
    "synonyms (массив ИЗ ПРЕДОСТАВЛЕННОГО списка — те сырые названия, что покрывает позиция). "
    "Объединяй очевидные варианты одной услуги (ОАК, Общий анализ крови, CBC → одна позиция). "
    "НЕ объединяй разные анализы и панели в одну позицию. Не выдумывай названий вне списка. "
    'Ответ строго JSON: {"positions":[{"name_norm":"...","category":"...","synonyms":["..."]}]}'
)


def _openai_chat(messages: list[dict], model: str) -> str:
    with httpx.Client(timeout=settings.openai_batch_timeout_seconds) as client:
        resp = client.post(
            f"{settings.openai_base_url}/chat/completions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={
                "model": model,
                "messages": messages,
                "temperature": 0,
                "response_format": {"type": "json_object"},
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


def suggest_catalog(db: Session, batch: int = 120) -> dict:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    # Most frequent unmatched raw names first — biggest coverage win per suggestion.
    rows = db.execute(
        select(UnmatchedQueue.service_name_raw, func.count(UnmatchedQueue.id).label("n"))
        .where(UnmatchedQueue.status == "pending")
        .group_by(UnmatchedQueue.service_name_raw)
        .order_by(func.count(UnmatchedQueue.id).desc())
        .limit(batch)
    ).all()
    if not rows:
        return {"suggested": 0, "reason": "queue empty"}
    counts = {r[0]: int(r[1]) for r in rows}
    raw_names = list(counts.keys())

    existing = {normalize_string(r) for (r,) in db.execute(select(ServiceCatalog.name_norm)).all()}
    pending = {
        normalize_string(r)
        for (r,) in db.execute(
            select(CatalogSuggestion.proposed_name_norm).where(CatalogSuggestion.status == "pending")
        ).all()
    }

    user = (
        "Существующие позиции каталога (НЕ дублируй их):\n"
        + ", ".join(sorted(existing))[:3000]
        + "\n\nСырые названия для группировки:\n"
        + "\n".join(f"- {n}" for n in raw_names)
    )
    try:
        content = _openai_chat(
            [{"role": "system", "content": _SYSTEM}, {"role": "user", "content": user}],
            settings.openai_model,
        )
        positions = json.loads(content).get("positions", [])
    except Exception as exc:
        logger.exception("ai_normalize: LLM call/parse failed")
        raise RuntimeError(f"LLM error: {exc}") from exc

    raw_set = set(raw_names)
    created = 0
    for pos in positions:
        name = (pos.get("name_norm") or "").strip()
        cat = (pos.get("category") or "").strip()
        syns = [s for s in (pos.get("synonyms") or []) if s in raw_set]  # only real ones
        if not name or cat not in CATEGORIES or not syns:
            continue
        norm = normalize_string(name)
        if norm in existing or norm in pending:
            continue
        pending.add(norm)
        db.add(
            CatalogSuggestion(
                proposed_name_norm=name,
                category=cat,
                synonyms=syns,
                sample_count=sum(counts.get(s, 1) for s in syns),
                confidence=0.0,
                status="pending",
            )
        )
        created += 1
    db.commit()
    logger.info("ai_normalize: %d suggestions from %d raw names", created, len(raw_names))
    return {"suggested": created, "from_raw": len(raw_names)}
