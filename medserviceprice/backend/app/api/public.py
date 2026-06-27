"""Public read endpoints (TZ §7.1)."""
from __future__ import annotations

import hashlib
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import func

from app.core.config import settings
from app.core.db import get_db
from app.core.redis_client import cache_get, cache_set
from app.models import Clinic, PriceHistory, ServiceCatalog, ServiceOffer, Subscription
from app.schemas import (
    ClinicDetail,
    ClinicPin,
    ClinicsMapResponse,
    OffersResponse,
    PriceHistoryResponse,
    ServiceSuggestion,
    SubscriptionCreate,
    SubscriptionOut,
)
from app.services import queries
from app.services.search import attach_offer_stats, search_services

router = APIRouter(prefix="/api", tags=["public"])


@router.get("/clinics-map", response_model=ClinicsMapResponse)
async def clinics_map(
    city: str | None = None, db: AsyncSession = Depends(get_db)
) -> ClinicsMapResponse:
    """Geolocated clinics for the map view (TZ §3.4)."""
    stmt = (
        select(
            Clinic.id, Clinic.name, Clinic.city, Clinic.address,
            Clinic.lat, Clinic.lng, Clinic.verified,
            func.count(ServiceOffer.id).filter(ServiceOffer.is_active.is_(True)).label("offers"),
        )
        .outerjoin(ServiceOffer, ServiceOffer.clinic_id == Clinic.id)
        .where(Clinic.lat.isnot(None), Clinic.lng.isnot(None))
        .group_by(Clinic.id)
    )
    if city:
        stmt = stmt.where(Clinic.city == city)
    rows = (await db.execute(stmt)).all()
    return ClinicsMapResponse(
        items=[
            ClinicPin(
                id=str(r.id), name=r.name, city=r.city, address=r.address,
                lat=float(r.lat), lng=float(r.lng), verified=bool(r.verified),
                offers_count=int(r.offers or 0),
            )
            for r in rows
        ]
    )


@router.get("/services/search", response_model=list[ServiceSuggestion])
async def search(
    q: str = Query("", min_length=0, max_length=120),
    mode: str = Query("hybrid", pattern="^(lexical|semantic|hybrid)$"),
    db: AsyncSession = Depends(get_db),
) -> list[ServiceSuggestion]:
    if len(q.strip()) < 2:
        return []
    cache_key = f"ac:{mode}:{q.strip().lower()}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return [ServiceSuggestion(**c) for c in cached]

    hits = await search_services(db, q, mode=mode, limit=8)
    with_stats = await attach_offer_stats(db, hits)
    result = [
        ServiceSuggestion(
            id=str(h.id),
            name_norm=h.name_norm,
            category=h.category,
            score=round(h.score, 4),
            offers_count=count,
            min_price_kzt=minp,
        )
        for h, count, minp in with_stats
    ]
    await cache_set(cache_key, [r.model_dump() for r in result], settings.cache_ttl_autocomplete)
    return result


@router.get("/offers", response_model=OffersResponse)
async def offers(
    service_id: uuid.UUID | None = None,
    q: str | None = None,
    city: str | None = None,
    category: str | None = Query(None, pattern="^(laboratory|doctor_visit|diagnostics|procedure)$"),
    price_min: float | None = Query(None, ge=0),
    price_max: float | None = Query(None, ge=0),
    max_duration_days: int | None = Query(None, ge=0, le=365),
    verified_only: bool = Query(False),
    min_rating: float | None = Query(None, ge=0, le=5),
    online_booking: bool = Query(False),
    user_lat: float | None = Query(None, ge=-90, le=90),
    user_lng: float | None = Query(None, ge=-180, le=180),
    sort: str = Query("price_asc", pattern="^(price_asc|price_desc|updated_desc|rating_desc|distance)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),  # cap per TZ §11
    db: AsyncSession = Depends(get_db),
) -> OffersResponse:
    # Resolve a free-text q to a service_id (best lexical hit) when service_id absent.
    if service_id is None and q:
        hits = await search_services(db, q, mode="hybrid", limit=1)
        if hits:
            service_id = hits[0].id

    params = {
        "service_id": str(service_id) if service_id else None,
        "city": city, "category": category, "price_min": price_min,
        "price_max": price_max, "max_duration_days": max_duration_days,
        "verified_only": verified_only, "min_rating": min_rating,
        "online_booking": online_booking,
        # round coords so nearby requests share a cache entry
        "user_lat": round(user_lat, 3) if user_lat is not None else None,
        "user_lng": round(user_lng, 3) if user_lng is not None else None,
        "sort": sort, "page": page, "page_size": page_size,
    }
    cache_key = "offers:" + hashlib.sha256(str(sorted(params.items())).encode()).hexdigest()[:24]
    cached = await cache_get(cache_key)
    if cached is not None:
        return OffersResponse(**cached)

    resp = await queries.get_offers(
        db, service_id=service_id, city=city, category=category,
        price_min=price_min, price_max=price_max, max_duration_days=max_duration_days,
        verified_only=verified_only, min_rating=min_rating, online_booking=online_booking,
        user_lat=user_lat, user_lng=user_lng, sort=sort, page=page, page_size=page_size,
    )
    await cache_set(cache_key, resp.model_dump(mode="json"), settings.cache_ttl_offers)
    return resp


@router.get("/clinics/{clinic_id}", response_model=ClinicDetail)
async def clinic_detail(clinic_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> ClinicDetail:
    cache_key = f"clinic:{clinic_id}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return ClinicDetail(**cached)
    detail = await queries.get_clinic_detail(db, clinic_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Clinic not found")
    await cache_set(cache_key, detail.model_dump(mode="json"), settings.cache_ttl_clinic)
    return detail


@router.get("/services/{service_id}/price-history", response_model=PriceHistoryResponse)
async def price_history(
    service_id: uuid.UUID,
    clinic_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> PriceHistoryResponse:
    svc = (
        await db.execute(select(ServiceCatalog).where(ServiceCatalog.id == service_id))
    ).scalar_one_or_none()
    if svc is None:
        raise HTTPException(status_code=404, detail="Service not found")

    stmt = select(PriceHistory).where(PriceHistory.service_id == service_id)
    if clinic_id:
        stmt = stmt.where(PriceHistory.clinic_id == clinic_id)
    stmt = stmt.order_by(PriceHistory.recorded_at.asc())
    rows = (await db.execute(stmt)).scalars().all()

    return PriceHistoryResponse(
        service_id=str(service_id),
        clinic_id=str(clinic_id) if clinic_id else None,
        service_name_norm=svc.name_norm,
        points=[{"recorded_at": r.recorded_at, "price_kzt": float(r.price_kzt)} for r in rows],
    )


@router.post("/subscriptions", response_model=SubscriptionOut)
async def subscribe(payload: SubscriptionCreate, db: AsyncSession = Depends(get_db)) -> SubscriptionOut:
    sub = Subscription(
        email=str(payload.email), service_id=payload.service_id, clinic_id=payload.clinic_id
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return SubscriptionOut(ok=True, id=str(sub.id))
