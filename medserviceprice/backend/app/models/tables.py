"""SQLAlchemy ORM models mirroring the PostgreSQL schema in TZ §4."""
from __future__ import annotations

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.core.db import Base


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


# --- 4.1 Raw layer -----------------------------------------------------------
class RawRecord(Base):
    __tablename__ = "raw_records"

    id: Mapped[uuid.UUID] = _uuid_pk()
    source_key: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    raw_payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    content_hash: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("source_key", "content_hash", name="uq_raw_source_hash"),
        Index("idx_raw_parsed_at", "parsed_at"),
    )


# --- 4.2 Normalized layer ----------------------------------------------------
class Clinic(Base):
    __tablename__ = "clinics"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(Text, nullable=False)
    city: Mapped[str] = mapped_column(Text, nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    working_hours: Mapped[str | None] = mapped_column(Text)
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    source_url: Mapped[str | None] = mapped_column(Text)
    rating: Mapped[float | None] = mapped_column(Float)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    # True when the clinic accepts online booking (e.g. it's listed on doq.kz).
    has_online_booking: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Enrichment (clinic's own structured data + official Places API)
    photo_url: Mapped[str | None] = mapped_column(Text)
    socials: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    place_id: Mapped[str | None] = mapped_column(Text)          # 2GIS/Google place ref
    place_source: Mapped[str | None] = mapped_column(Text)      # '2gis' | 'google'
    place_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    offers: Mapped[list["ServiceOffer"]] = relationship(back_populates="clinic")
    reviews: Mapped[list["ClinicReview"]] = relationship(
        back_populates="clinic", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("name", "city", name="uq_clinic_name_city"),
        Index("idx_clinics_city", "city"),
    )


class ServiceCatalog(Base):
    __tablename__ = "services_catalog"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name_norm: Mapped[str] = mapped_column(Text, nullable=False)
    synonyms: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(settings.embedding_dim))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    offers: Mapped[list["ServiceOffer"]] = relationship(back_populates="service")

    __table_args__ = (
        UniqueConstraint("name_norm", name="uq_catalog_name_norm"),
        CheckConstraint(
            "category IN ('laboratory','doctor_visit','diagnostics','procedure')",
            name="ck_catalog_category",
        ),
    )


class ServiceOffer(Base):
    __tablename__ = "service_offers"

    id: Mapped[uuid.UUID] = _uuid_pk()
    clinic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinics.id"), nullable=False)
    service_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("services_catalog.id"))
    service_name_raw: Mapped[str] = mapped_column(Text, nullable=False)
    price_kzt: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(Text, nullable=False, default="KZT")
    duration_days: Mapped[int | None] = mapped_column(Integer)
    source_url: Mapped[str | None] = mapped_column(Text)
    parsed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    offer_hash: Mapped[str] = mapped_column(Text, nullable=False)

    clinic: Mapped["Clinic"] = relationship(back_populates="offers")
    service: Mapped["ServiceCatalog | None"] = relationship(back_populates="offers")

    __table_args__ = (
        UniqueConstraint("clinic_id", "offer_hash", name="uq_offer_clinic_hash"),
        CheckConstraint("currency IN ('KZT','USD')", name="ck_offer_currency"),
        Index("idx_offers_service_active", "service_id", "is_active"),
        Index("idx_offers_price", "price_kzt"),
    )


# --- 4.3 Support tables ------------------------------------------------------
class UnmatchedQueue(Base):
    __tablename__ = "unmatched_queue"

    id: Mapped[uuid.UUID] = _uuid_pk()
    service_name_raw: Mapped[str] = mapped_column(Text, nullable=False)
    source_key: Mapped[str] = mapped_column(Text, nullable=False)
    suggested_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("services_catalog.id"))
    match_score: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(Text, default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("status IN ('pending','resolved','ignored')", name="ck_unmatched_status"),
    )


class ParseLog(Base):
    __tablename__ = "parse_logs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    source_key: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    records_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("status IN ('success','partial','failed')", name="ck_parselog_status"),
    )


class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[uuid.UUID] = _uuid_pk()
    clinic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinics.id"), nullable=False)
    service_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("services_catalog.id"), nullable=False)
    price_kzt: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("idx_price_history_lookup", "service_id", "clinic_id", "recorded_at"),
    )


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = _uuid_pk()
    email: Mapped[str] = mapped_column(Text, nullable=False)
    service_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("services_catalog.id"), nullable=False)
    clinic_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("clinics.id"))
    # Last price we notified about — guards against re-notifying on the same drop.
    notified_price_kzt: Mapped[float | None] = mapped_column(Numeric(12, 2))
    last_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ClinicReview(Base):
    """Reviews fetched from an official Places API (2GIS/Google), not scraped.

    `author_alias` stores only the public display name the platform returns; we
    keep a stable `external_id` to dedup on re-sync. No other PII is collected.
    """

    __tablename__ = "clinic_reviews"

    id: Mapped[uuid.UUID] = _uuid_pk()
    clinic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinics.id"), nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)            # '2gis' | 'google'
    external_id: Mapped[str] = mapped_column(Text, nullable=False)       # platform review id
    author_alias: Mapped[str | None] = mapped_column(Text)
    rating: Mapped[float | None] = mapped_column(Float)
    text: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    url: Mapped[str | None] = mapped_column(Text)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    clinic: Mapped["Clinic"] = relationship(back_populates="reviews")

    __table_args__ = (
        UniqueConstraint("source", "external_id", name="uq_review_source_extid"),
        Index("idx_reviews_clinic", "clinic_id"),
    )


class Alert(Base):
    """Operational alert raised when data collection goes wrong — a parse fails,
    returns no records, or a source goes stale. Surfaced in the admin panel and
    optionally emailed, so source breakage is caught before users see empty pages."""

    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = _uuid_pk()
    source_key: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(Text, nullable=False)   # 'error' | 'warning' | 'info'
    kind: Mapped[str] = mapped_column(Text, nullable=False)       # parse_failed | no_records | source_stale
    message: Mapped[str] = mapped_column(Text, nullable=False)
    acknowledged: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("severity IN ('error','warning','info')", name="ck_alert_severity"),
        Index("idx_alerts_open", "acknowledged", "created_at"),
        Index("idx_alerts_dedup", "source_key", "kind", "acknowledged"),
    )
