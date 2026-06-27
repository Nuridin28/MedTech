"""Pydantic v2 schemas — response shapes match the frontend contract (TZ §7.1)."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

Category = Literal["laboratory", "doctor_visit", "diagnostics", "procedure"]
SortOrder = Literal["price_asc", "price_desc", "updated_desc", "rating_desc"]
SearchMode = Literal["lexical", "semantic", "hybrid"]


class ServiceSuggestion(BaseModel):
    id: str
    name_norm: str
    category: str
    score: float
    offers_count: int
    min_price_kzt: float | None = None


class ClinicMini(BaseModel):
    id: str
    name: str
    city: str
    address: str | None = None
    working_hours: str | None = None
    lat: float | None = None
    lng: float | None = None
    rating: float | None = None
    reviews_count: int = 0
    photo_url: str | None = None
    logo_color: str = "#0052cc"
    verified: bool = False
    has_online_booking: bool = False


class ClinicReviewOut(BaseModel):
    source: str
    author_alias: str | None = None
    rating: float | None = None
    text: str | None = None
    published_at: datetime | None = None
    url: str | None = None


class Offer(BaseModel):
    offer_id: str
    clinic: ClinicMini
    service_id: str | None
    service_name_norm: str
    category: str
    price_kzt: float
    currency: str = "KZT"
    duration_days: int | None = None
    source_url: str | None = None
    parsed_at: datetime
    freshness_days: int
    is_lowest: bool = False


class OffersResponse(BaseModel):
    items: list[Offer]
    total: int
    page: int
    page_size: int
    price_min: float = 0
    price_max: float = 0
    price_avg: float = 0


class ClinicServiceLine(BaseModel):
    offer_id: str
    service_id: str | None
    service_name_norm: str
    category: str
    price_kzt: float
    duration_days: int | None = None
    freshness_days: int


class ClinicDetail(BaseModel):
    id: str
    name: str
    city: str
    address: str | None = None
    phone: str | None = None
    working_hours: str | None = None
    lat: float | None = None
    lng: float | None = None
    source_url: str | None = None
    rating: float | None = None
    reviews_count: int = 0
    photo_url: str | None = None
    socials: list[str] = []
    logo_color: str = "#0052cc"
    verified: bool = False
    has_online_booking: bool = False
    services: list[ClinicServiceLine]
    reviews: list[ClinicReviewOut] = []


class PriceHistoryPoint(BaseModel):
    recorded_at: datetime
    price_kzt: float


class PriceHistoryResponse(BaseModel):
    service_id: str
    clinic_id: str | None
    service_name_norm: str
    points: list[PriceHistoryPoint]


class SubscriptionCreate(BaseModel):
    email: EmailStr
    service_id: uuid.UUID
    clinic_id: uuid.UUID | None = None


class SubscriptionOut(BaseModel):
    ok: bool = True
    id: str


# --- Admin ---
class ParseRunRequest(BaseModel):
    sources: list[str] | None = Field(
        default=None, description="Source keys to parse; null = all registered sources"
    )


class ParseRunResponse(BaseModel):
    queued: list[str]
    task_ids: list[str]


class ParseLogOut(BaseModel):
    id: str
    source_key: str
    status: str
    records_count: int
    error_message: str | None
    started_at: datetime | None
    finished_at: datetime


class UnmatchedOut(BaseModel):
    id: str
    service_name_raw: str
    source_key: str
    suggested_id: str | None
    match_score: float | None
    status: str
    created_at: datetime


class UnmatchedResolve(BaseModel):
    service_id: uuid.UUID
    add_as_synonym: bool = True


class ImportResponse(BaseModel):
    ok: bool = True
    source_key: str
    task_id: str
    filename: str


# --- Admin dashboard / analytics ---
class SourceHealth(BaseModel):
    source_key: str
    registered: bool = True
    last_status: str | None = None
    last_records: int | None = None
    last_finished_at: datetime | None = None
    stale: bool = False


class AdminStats(BaseModel):
    clinics: int
    catalog_services: int
    active_offers: int
    normalized_offers: int
    unmatched_pending: int
    open_alerts: int
    cities: int
    sources: list[SourceHealth]
    offers_by_category: dict[str, int]
    offers_by_city: dict[str, int]
    avg_price_by_category: dict[str, float]


# --- AI catalog suggestions ---
class CatalogSuggestionOut(BaseModel):
    id: str
    proposed_name_norm: str
    category: str
    synonyms: list[str]
    sample_count: int
    status: str
    created_at: datetime


# --- Operational alerts ---
class AlertOut(BaseModel):
    id: str
    source_key: str
    severity: str
    kind: str
    message: str
    acknowledged: bool
    created_at: datetime


# --- ELK logs ---
class LogEntry(BaseModel):
    timestamp: str | None = Field(default=None, alias="@timestamp")
    level: str | None = None
    logger: str | None = None
    message: str | None = None
    source_key: str | None = None
    exception: str | None = None

    model_config = {"populate_by_name": True}


class LogsResponse(BaseModel):
    available: bool
    items: list[LogEntry] = []
    kibana_url: str | None = None


# --- Map (TZ §3.4) ---
class ClinicPin(BaseModel):
    id: str
    name: str
    city: str
    address: str | None = None
    lat: float
    lng: float
    verified: bool = False
    offers_count: int = 0


class ClinicsMapResponse(BaseModel):
    items: list[ClinicPin]


# --- AI assistant (domain-scoped chatbot behind a safety gateway) ---
class ChatTurn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=1000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)


class ChatResponse(BaseModel):
    reply: str
    # 'answered' | 'refused_offtopic' | 'blocked_input' | 'blocked_output'
    decision: str
