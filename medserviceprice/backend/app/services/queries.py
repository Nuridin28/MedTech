"""Read-side query helpers: build the offer / clinic responses (TZ §7.1, §10)."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models import Clinic, ServiceCatalog, ServiceOffer
from app.schemas import (
    ClinicDetail,
    ClinicMini,
    ClinicServiceLine,
    Offer,
    OffersResponse,
)


def _stale_cutoff() -> datetime:
    """Offers parsed before this are not considered current (TZ §4)."""
    return datetime.now(timezone.utc) - timedelta(days=settings.stale_after_days)

_PALETTE = ["#0052cc", "#00687b", "#7b2600", "#003d9b", "#36B37E", "#FF8B00", "#0c56d0", "#00a669"]


def color_for(name: str) -> str:
    return _PALETTE[sum(map(ord, name)) % len(_PALETTE)]


def freshness_days(parsed_at: datetime) -> int:
    now = datetime.now(timezone.utc)
    pa = parsed_at if parsed_at.tzinfo else parsed_at.replace(tzinfo=timezone.utc)
    return max(0, (now - pa).days)


def _clinic_mini(c: Clinic) -> ClinicMini:
    return ClinicMini(
        id=str(c.id),
        name=c.name,
        city=c.city,
        address=c.address,
        working_hours=c.working_hours,
        lat=c.lat,
        lng=c.lng,
        rating=c.rating,
        reviews_count=c.reviews_count or 0,
        logo_color=color_for(c.name),
        verified=bool(c.verified),
    )


def _to_offer(o: ServiceOffer, service_name: str, lowest_price: float | None) -> Offer:
    return Offer(
        offer_id=str(o.id),
        clinic=_clinic_mini(o.clinic),
        service_id=str(o.service_id) if o.service_id else None,
        service_name_norm=service_name,
        category=o.service.category if o.service else "laboratory",
        price_kzt=float(o.price_kzt),
        currency=o.currency,
        duration_days=o.duration_days,
        source_url=o.source_url,
        parsed_at=o.parsed_at,
        freshness_days=freshness_days(o.parsed_at),
        is_lowest=lowest_price is not None and float(o.price_kzt) == lowest_price,
    )


async def get_offers(
    db: AsyncSession,
    *,
    service_id: uuid.UUID | None,
    city: str | None,
    category: str | None,
    price_min: float | None,
    price_max: float | None,
    sort: str,
    page: int,
    page_size: int,
    max_duration_days: int | None = None,
    verified_only: bool = False,
) -> OffersResponse:
    base = (
        select(ServiceOffer)
        .join(Clinic, ServiceOffer.clinic_id == Clinic.id)
        .outerjoin(ServiceCatalog, ServiceOffer.service_id == ServiceCatalog.id)
        .options(selectinload(ServiceOffer.clinic), selectinload(ServiceOffer.service))
        .where(ServiceOffer.is_active.is_(True))
        .where(ServiceOffer.parsed_at >= _stale_cutoff())  # TZ §4: hide data >30d old
    )
    if service_id:
        base = base.where(ServiceOffer.service_id == service_id)
    if city:
        base = base.where(Clinic.city == city)
    if category:
        base = base.where(ServiceCatalog.category == category)
    if price_min is not None:
        base = base.where(ServiceOffer.price_kzt >= price_min)
    if price_max is not None:
        base = base.where(ServiceOffer.price_kzt <= price_max)
    if max_duration_days is not None:
        base = base.where(ServiceOffer.duration_days <= max_duration_days)
    if verified_only:
        base = base.where(Clinic.verified.is_(True))

    # aggregate stats over the full filtered set
    stats_q = base.with_only_columns(
        func.count(ServiceOffer.id),
        func.min(ServiceOffer.price_kzt),
        func.max(ServiceOffer.price_kzt),
        func.avg(ServiceOffer.price_kzt),
    ).order_by(None)
    total, pmin, pmax, pavg = (await db.execute(stats_q)).one()
    total = int(total or 0)
    lowest = float(pmin) if pmin is not None else None

    sort_map = {
        "price_asc": ServiceOffer.price_kzt.asc(),
        "price_desc": ServiceOffer.price_kzt.desc(),
        "updated_desc": ServiceOffer.parsed_at.desc(),
        "rating_desc": Clinic.rating.desc().nullslast(),
    }
    base = base.order_by(sort_map.get(sort, ServiceOffer.price_kzt.asc()))
    base = base.limit(page_size).offset((page - 1) * page_size)

    rows = (await db.execute(base)).scalars().all()
    items = [
        _to_offer(o, o.service.name_norm if o.service else o.service_name_raw, lowest)
        for o in rows
    ]
    return OffersResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        price_min=float(pmin) if pmin is not None else 0,
        price_max=float(pmax) if pmax is not None else 0,
        price_avg=round(float(pavg), 2) if pavg is not None else 0,
    )


async def get_clinic_detail(db: AsyncSession, clinic_id: uuid.UUID) -> ClinicDetail | None:
    clinic = (
        await db.execute(
            select(Clinic)
            .where(Clinic.id == clinic_id)
            .options(selectinload(Clinic.offers).selectinload(ServiceOffer.service))
        )
    ).scalar_one_or_none()
    if clinic is None:
        return None

    cutoff = _stale_cutoff()
    lines: list[ClinicServiceLine] = []
    for o in clinic.offers:
        if not o.is_active:
            continue
        pa = o.parsed_at if o.parsed_at.tzinfo else o.parsed_at.replace(tzinfo=timezone.utc)
        if pa < cutoff:  # TZ §4: don't present stale prices as current
            continue
        lines.append(
            ClinicServiceLine(
                offer_id=str(o.id),
                service_id=str(o.service_id) if o.service_id else None,
                service_name_norm=o.service.name_norm if o.service else o.service_name_raw,
                category=o.service.category if o.service else "laboratory",
                price_kzt=float(o.price_kzt),
                duration_days=o.duration_days,
                freshness_days=freshness_days(o.parsed_at),
            )
        )
    lines.sort(key=lambda x: (x.category, x.price_kzt))

    return ClinicDetail(
        id=str(clinic.id),
        name=clinic.name,
        city=clinic.city,
        address=clinic.address,
        phone=clinic.phone,
        working_hours=clinic.working_hours,
        lat=clinic.lat,
        lng=clinic.lng,
        source_url=clinic.source_url,
        rating=clinic.rating,
        reviews_count=clinic.reviews_count or 0,
        logo_color=color_for(clinic.name),
        verified=bool(clinic.verified),
        services=lines,
    )
