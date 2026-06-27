"""Celery application + beat schedule (TZ §5.2, §12 — daily refresh)."""
from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings
from app.core.logging_setup import setup_logging
from app.parsers.registry import all_source_keys

setup_logging()  # JSON logs + Elasticsearch shipping in worker/beat too

celery_app = Celery(
    "medserviceprice",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Almaty",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_max_tasks_per_child=50,
)

# Auto-discover tasks
celery_app.autodiscover_tasks(["app.tasks"])

# Beat: one task per source per day so a single source failing can't block the rest
# (TZ §5.2 isolation). Staggered by 7-minute offsets to avoid hammering at once.
celery_app.conf.beat_schedule = {
    f"daily-parse-{key}": {
        "task": "app.tasks.parsing.parse_source",
        "schedule": crontab(hour=3, minute=(i * 7) % 60),
        "args": (key,),
    }
    for i, key in enumerate(all_source_keys())
}

# Recompute catalog embeddings nightly (only acts when ENABLE_SEMANTIC=true).
celery_app.conf.beat_schedule["nightly-embeddings"] = {
    "task": "app.tasks.embeddings_task.refresh_embeddings",
    "schedule": crontab(hour=2, minute=30),
}

# Geocode any clinics still missing coordinates (TZ §3.4 map), nightly after parse.
celery_app.conf.beat_schedule["nightly-geocode"] = {
    "task": "app.tasks.geocode_task.geocode_clinics",
    "schedule": crontab(hour=4, minute=0),
}

# Enrich clinics: own-site metadata/photo + official Places ratings/reviews, nightly.
celery_app.conf.beat_schedule["nightly-enrich"] = {
    "task": "app.tasks.enrich_task.enrich_clinics",
    "schedule": crontab(hour=4, minute=30),
}

# Check tracked prices and notify subscribers on a drop (TZ §3.4), twice daily.
celery_app.conf.beat_schedule["price-drop-alerts"] = {
    "task": "app.tasks.subscriptions_task.notify_price_drops",
    "schedule": crontab(hour="9,18", minute=0),
}
