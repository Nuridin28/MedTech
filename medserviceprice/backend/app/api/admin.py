"""Admin endpoints (TZ §7.2) — protected by the admin API key."""
from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.core.security import require_admin
from app.models import Alert, ParseLog, ServiceCatalog, ServiceOffer, UnmatchedQueue
from app.parsers.registry import all_source_keys
from app.schemas import (
    AdminStats,
    AlertOut,
    ImportResponse,
    LogsResponse,
    ParseLogOut,
    ParseRunRequest,
    ParseRunResponse,
    UnmatchedOut,
    UnmatchedResolve,
)
from app.services.admin_stats import get_admin_stats
from app.services.file_extract import SUPPORTED_EXTENSIONS
from app.services.log_query import query_logs

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _slug(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", s.lower().strip()).strip("_")
    return s or "source"


@router.get("/stats", response_model=AdminStats)
async def stats(db: AsyncSession = Depends(get_db)) -> AdminStats:
    """Dashboard analytics. Doubles as the auth-validation call for the admin SPA
    (a 200 here means the API key is valid)."""
    return await get_admin_stats(db)


@router.post("/parse/run", response_model=ParseRunResponse)
async def run_parse(payload: ParseRunRequest) -> ParseRunResponse:
    from app.tasks.parsing import parse_source  # lazy import (Celery)

    sources = payload.sources or all_source_keys()
    unknown = [s for s in sources if s not in all_source_keys()]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown sources: {unknown}")

    task_ids: list[str] = []
    for key in sources:
        res = parse_source.delay(key)
        task_ids.append(str(res.id))
    return ParseRunResponse(queued=sources, task_ids=task_ids)


@router.post("/import/upload", response_model=ImportResponse)
async def import_upload(
    clinic_name: str = Form(..., min_length=2, max_length=200),
    city: str = Form(..., min_length=2, max_length=60),
    address: str | None = Form(None),
    source_url: str | None = Form(None),
    file: UploadFile = File(...),
) -> ImportResponse:
    """Upload a clinic's published price list (Excel/CSV/PDF/DOCX) and ingest it
    through the standard pipeline (TZ §3.1). Lets non-technical staff add a source
    without writing a parser."""
    from app.tasks.import_task import import_file  # lazy (Celery)

    ext = Path(file.filename or "").suffix.lower().lstrip(".")
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '.{ext}'. Allowed: {', '.join(SUPPORTED_EXTENSIONS)}",
        )

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    source_key = f"file_{_slug(clinic_name)}_{_slug(city)}"
    safe_name = f"{source_key}_{uuid.uuid4().hex[:8]}.{ext}"
    dest = upload_dir / safe_name

    content = await file.read()
    if len(content) > 25 * 1024 * 1024:  # 25 MB cap
        raise HTTPException(status_code=413, detail="File too large (max 25 MB)")
    dest.write_bytes(content)

    clinic_meta = {
        "clinic_name": clinic_name.strip(),
        "city": city.strip(),
        "address": (address or "").strip() or None,
        "source_url": (source_url or "").strip() or None,
    }
    res = import_file.delay(str(dest), clinic_meta, source_key)
    return ImportResponse(ok=True, source_key=source_key, task_id=str(res.id), filename=safe_name)


@router.post("/geocode/run")
async def run_geocode() -> dict:
    """Fill missing clinic coordinates for the map (TZ §3.4)."""
    from app.tasks.geocode_task import geocode_clinics

    res = geocode_clinics.delay()
    return {"queued": True, "task_id": str(res.id)}


@router.post("/enrich/run")
async def run_enrich(only_missing: bool = True) -> dict:
    """Enrich clinics: metadata/photo from their own JSON-LD, plus ratings/reviews
    from the official Places API when configured (off by default)."""
    from app.tasks.enrich_task import enrich_clinics

    res = enrich_clinics.delay(only_missing)
    return {"queued": True, "task_id": str(res.id)}


@router.get("/alerts", response_model=list[AlertOut])
async def list_alerts(
    acknowledged: bool = False, limit: int = 100, db: AsyncSession = Depends(get_db)
) -> list[AlertOut]:
    rows = (
        await db.execute(
            select(Alert)
            .where(Alert.acknowledged.is_(acknowledged))
            .order_by(Alert.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [
        AlertOut(
            id=str(a.id), source_key=a.source_key, severity=a.severity, kind=a.kind,
            message=a.message, acknowledged=a.acknowledged, created_at=a.created_at,
        )
        for a in rows
    ]


@router.post("/alerts/{alert_id}/ack")
async def ack_alert(alert_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> dict:
    from datetime import datetime, timezone

    a = (await db.execute(select(Alert).where(Alert.id == alert_id))).scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    a.acknowledged = True
    a.acknowledged_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True, "acknowledged": str(alert_id)}


@router.post("/alerts/ack-all")
async def ack_all_alerts(db: AsyncSession = Depends(get_db)) -> dict:
    from datetime import datetime, timezone

    res = await db.execute(
        update(Alert).where(Alert.acknowledged.is_(False)).values(
            acknowledged=True, acknowledged_at=datetime.now(timezone.utc)
        )
    )
    await db.commit()
    return {"ok": True, "acknowledged_count": res.rowcount or 0}


@router.get("/logs", response_model=LogsResponse)
async def system_logs(
    level: str | None = Query(None, pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$"),
    source: str | None = None,
    q: str | None = None,
    since_minutes: int = Query(60, ge=1, le=10080),
    limit: int = Query(100, ge=1, le=500),
) -> LogsResponse:
    """Application logs from Elasticsearch (ELK). Falls back to available=false
    when ES is disabled/unreachable so the UI can show a hint instead of erroring."""
    entries, available = await run_in_threadpool(
        query_logs, level=level, source=source, q=q, since_minutes=since_minutes, limit=limit
    )
    return LogsResponse(
        available=available,
        items=entries,
        kibana_url=settings.kibana_url or None,
    )


@router.get("/parse/logs", response_model=list[ParseLogOut])
async def parse_logs(limit: int = 50, db: AsyncSession = Depends(get_db)) -> list[ParseLogOut]:
    rows = (
        await db.execute(select(ParseLog).order_by(ParseLog.finished_at.desc()).limit(limit))
    ).scalars().all()
    return [
        ParseLogOut(
            id=str(r.id), source_key=r.source_key, status=r.status,
            records_count=r.records_count, error_message=r.error_message,
            started_at=r.started_at, finished_at=r.finished_at,
        )
        for r in rows
    ]


@router.get("/unmatched", response_model=list[UnmatchedOut])
async def unmatched(
    status: str = "pending", limit: int = 100, db: AsyncSession = Depends(get_db)
) -> list[UnmatchedOut]:
    rows = (
        await db.execute(
            select(UnmatchedQueue)
            .where(UnmatchedQueue.status == status)
            .order_by(UnmatchedQueue.match_score.desc().nullslast())
            .limit(limit)
        )
    ).scalars().all()
    return [
        UnmatchedOut(
            id=str(r.id), service_name_raw=r.service_name_raw, source_key=r.source_key,
            suggested_id=str(r.suggested_id) if r.suggested_id else None,
            match_score=r.match_score, status=r.status, created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/unmatched/{item_id}/resolve")
async def resolve_unmatched(
    item_id: uuid.UUID, payload: UnmatchedResolve, db: AsyncSession = Depends(get_db)
) -> dict:
    item = (
        await db.execute(select(UnmatchedQueue).where(UnmatchedQueue.id == item_id))
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Queue item not found")
    svc = (
        await db.execute(select(ServiceCatalog).where(ServiceCatalog.id == payload.service_id))
    ).scalar_one_or_none()
    if svc is None:
        raise HTTPException(status_code=404, detail="Target service not found")

    # Optionally learn the raw name as a synonym so re-normalization auto-attaches it.
    if payload.add_as_synonym and item.service_name_raw not in (svc.synonyms or []):
        svc.synonyms = [*(svc.synonyms or []), item.service_name_raw]

    # Attach all offers that carry this raw name to the chosen catalog service.
    await db.execute(
        update(ServiceOffer)
        .where(ServiceOffer.service_name_raw == item.service_name_raw, ServiceOffer.service_id.is_(None))
        .values(service_id=payload.service_id)
    )
    item.status = "resolved"
    item.suggested_id = payload.service_id
    await db.commit()
    return {"ok": True, "resolved": str(item_id), "linked_to": str(payload.service_id)}
