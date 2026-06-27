"""Synchronous SQLAlchemy session for Celery workers and seed scripts."""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

sync_engine = create_engine(settings.sync_database_url, pool_pre_ping=True, future=True)
SyncSession: sessionmaker[Session] = sessionmaker(bind=sync_engine, expire_on_commit=False)
