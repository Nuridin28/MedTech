"""Admin dashboard analytics — aggregate counts + per-source health (TZ §7.2)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import (
    Alert,
    Clinic,
    ParseLog,
    ServiceCatalog,
    ServiceOffer,
    UnmatchedQueue,
)
from app.parsers.registry import all_source_keys
from app.schemas import AdminStats, SourceHealth


async def get_admin_stats(db: AsyncSession) -> AdminStats:
    async def scalar(stmt) -> int:
        return int((await db.execute(stmt)).scalar_one() or 0)

    clinics = await scalar(select(func.count(Clinic.id)))
    catalog = await scalar(select(func.count(ServiceCatalog.id)))
    active = await scalar(select(func.count(ServiceOffer.id)).where(ServiceOffer.is_active.is_(True)))
    normalized = await scalar(
        select(func.count(ServiceOffer.id)).where(
            ServiceOffer.is_active.is_(True), ServiceOffer.service_id.isnot(None)
        )
    )
    unmatched = await scalar(
        select(func.count(UnmatchedQueue.id)).where(UnmatchedQueue.status == "pending")
    )
    open_alerts = await scalar(select(func.count(Alert.id)).where(Alert.acknowledged.is_(False)))
    cities = await scalar(select(func.count(func.distinct(Clinic.city))))

    cat_rows = (
        await db.execute(
            select(ServiceCatalog.category, func.count(ServiceOffer.id))
            .join(ServiceOffer, ServiceOffer.service_id == ServiceCatalog.id)
            .where(ServiceOffer.is_active.is_(True))
            .group_by(ServiceCatalog.category)
        )
    ).all()
    offers_by_category = {r[0]: int(r[1]) for r in cat_rows}

    avg_rows = (
        await db.execute(
            select(ServiceCatalog.category, func.avg(ServiceOffer.price_kzt))
            .join(ServiceOffer, ServiceOffer.service_id == ServiceCatalog.id)
            .where(ServiceOffer.is_active.is_(True))
            .group_by(ServiceCatalog.category)
        )
    ).all()
    avg_price_by_category = {r[0]: round(float(r[1]), 2) for r in avg_rows if r[1] is not None}

    city_rows = (
        await db.execute(
            select(Clinic.city, func.count(ServiceOffer.id))
            .join(ServiceOffer, ServiceOffer.clinic_id == Clinic.id)
            .where(ServiceOffer.is_active.is_(True))
            .group_by(Clinic.city)
            .order_by(func.count(ServiceOffer.id).desc())
        )
    ).all()
    offers_by_city = {r[0]: int(r[1]) for r in city_rows}

    # latest parse per source (DISTINCT ON)
    latest = (
        await db.execute(
            select(
                ParseLog.source_key, ParseLog.status, ParseLog.records_count, ParseLog.finished_at
            )
            .distinct(ParseLog.source_key)
            .order_by(ParseLog.source_key, ParseLog.finished_at.desc())
        )
    ).all()
    latest_map = {r[0]: r for r in latest}

    registered = set(all_source_keys())
    stale_cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.source_stale_hours)
    sources: list[SourceHealth] = []
    for key in sorted(registered | set(latest_map.keys())):
        row = latest_map.get(key)
        if row is None:
            sources.append(SourceHealth(source_key=key, registered=key in registered))
            continue
        fa = row[3]
        fa_tz = (fa if fa.tzinfo else fa.replace(tzinfo=timezone.utc)) if fa else None
        sources.append(
            SourceHealth(
                source_key=key,
                registered=key in registered,
                last_status=row[1],
                last_records=row[2],
                last_finished_at=fa,
                stale=bool(fa_tz and fa_tz < stale_cutoff),
            )
        )

    return AdminStats(
        clinics=clinics,
        catalog_services=catalog,
        active_offers=active,
        normalized_offers=normalized,
        unmatched_pending=unmatched,
        open_alerts=open_alerts,
        cities=cities,
        sources=sources,
        offers_by_category=offers_by_category,
        offers_by_city=offers_by_city,
        avg_price_by_category=avg_price_by_category,
    )
