"""Basket / check-up: cheapest clinic for a BUNDLE of services.

Real pain: people sip a panel of tests (ОАК + глюкоза + ТТГ + витамин D), not one.
This finds, per clinic, the total price covering as many of the requested services as
possible, ranks clinics by coverage then total, and contrasts the best single-clinic
total against the theoretical "split across clinics" cheapest. Uses only active,
non-stale offers.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Clinic, ServiceCatalog, ServiceOffer
from app.schemas import BasketLine, BasketOption, BasketResponse
from app.services.queries import _clinic_mini, _stale_cutoff


async def basket_cheapest(
    db: AsyncSession, service_ids: list[uuid.UUID], city: str | None
) -> BasketResponse:
    names = {
        r[0]: r[1]
        for r in (
            await db.execute(
                select(ServiceCatalog.id, ServiceCatalog.name_norm).where(
                    ServiceCatalog.id.in_(service_ids)
                )
            )
        ).all()
    }
    requested = [sid for sid in service_ids if sid in names]
    if not requested:
        return BasketResponse(requested=0, options=[])

    stmt = (
        select(ServiceOffer)
        .join(Clinic, ServiceOffer.clinic_id == Clinic.id)
        .options(selectinload(ServiceOffer.clinic))
        .where(
            ServiceOffer.service_id.in_(requested),
            ServiceOffer.is_active.is_(True),
            ServiceOffer.parsed_at >= _stale_cutoff(),
        )
    )
    if city:
        stmt = stmt.where(Clinic.city == city)
    offers = (await db.execute(stmt)).scalars().all()

    # clinic -> {service_id: (price, offer)}, keeping the cheapest offer per service
    by_clinic: dict[uuid.UUID, dict[uuid.UUID, tuple[float, ServiceOffer]]] = {}
    clinics: dict[uuid.UUID, Clinic] = {}
    for o in offers:
        clinics[o.clinic_id] = o.clinic
        d = by_clinic.setdefault(o.clinic_id, {})
        cur = d.get(o.service_id)
        if cur is None or float(o.price_kzt) < cur[0]:
            d[o.service_id] = (float(o.price_kzt), o)

    # global cheapest per service (for the "split across clinics" baseline)
    global_min: dict[uuid.UUID, float] = {}
    for d in by_clinic.values():
        for sid, (p, _o) in d.items():
            if sid not in global_min or p < global_min[sid]:
                global_min[sid] = p
    split_total = (
        round(sum(global_min.values()), 2) if len(global_min) == len(requested) else None
    )

    options: list[BasketOption] = []
    for cid, d in by_clinic.items():
        lines = [
            BasketLine(
                service_id=str(sid), service_name_norm=names[sid],
                price_kzt=p, offer_id=str(o.id),
            )
            for sid, (p, o) in sorted(d.items(), key=lambda kv: names[kv[0]])
        ]
        options.append(
            BasketOption(
                clinic=_clinic_mini(clinics[cid]),
                covered=len(d),
                total_requested=len(requested),
                total_price=round(sum(p for p, _ in d.values()), 2),
                lines=lines,
                missing=[names[sid] for sid in requested if sid not in d],
            )
        )

    # full coverage first, then cheapest total
    options.sort(key=lambda x: (-x.covered, x.total_price))
    best_single = next((o.total_price for o in options if o.covered == len(requested)), None)

    return BasketResponse(
        requested=len(requested),
        options=options[:30],
        best_single_total=best_single,
        best_split_total=split_total,
    )
