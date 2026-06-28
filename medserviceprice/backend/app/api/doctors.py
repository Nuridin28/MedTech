"""Doctor appointments — live proxy to doq.kz (TZ §3.4).

Doctors with prices/ratings/specialties + live time slots, with our own sorting
(rating / price / soonest slot / experience / distance). Read-only, no DB writes.
"""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.schemas import DoctorsResponse, DoctorSlotsResponse, SpecialtyOut
from app.services import doq_live

router = APIRouter(prefix="/api/doctors", tags=["doctors"])


@router.get("", response_model=DoctorsResponse)
async def list_doctors(
    city: str = "Almaty",
    specialty: int | None = Query(None, description="doq specialty (service) id"),
    q: str | None = Query(None, max_length=80),
    sort: str = Query("rating", pattern="^(rating|price|soonest|experience|distance)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    user_lat: float | None = Query(None, ge=-90, le=90),
    user_lng: float | None = Query(None, ge=-180, le=180),
    appt_date: str | None = Query(None, alias="date", pattern="^\\d{4}-\\d{2}-\\d{2}$"),
    time_from: str | None = Query(None, pattern="^[0-2]?[0-9]:[0-5][0-9]$"),
    time_to: str | None = Query(None, pattern="^[0-2]?[0-9]:[0-5][0-9]$"),
) -> DoctorsResponse:
    return await doq_live.list_doctors(
        city=city, specialty=specialty, q=q, sort=sort, page=page,
        page_size=page_size, user_lat=user_lat, user_lng=user_lng,
        appt_date=appt_date, time_from=time_from, time_to=time_to,
    )


@router.get("/specialties", response_model=list[SpecialtyOut])
async def specialties(city: str = "Almaty") -> list[SpecialtyOut]:
    return await doq_live.specialties(city)


@router.get("/{doctor_id}/slots", response_model=DoctorSlotsResponse)
async def doctor_slots(
    doctor_id: int,
    branches: str | None = Query(None, description="comma-separated branch ids"),
    date_from: str | None = None,
    date_to: str | None = None,
) -> DoctorSlotsResponse:
    branch_ids = (
        [int(b) for b in branches.split(",") if b.strip().isdigit()] if branches else []
    )
    return await doq_live.doctor_slots(
        doctor_id=doctor_id, branch_ids=branch_ids, date_from=date_from, date_to=date_to
    )
