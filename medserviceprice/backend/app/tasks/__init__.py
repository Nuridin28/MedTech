"""Celery tasks package."""
from app.tasks import (  # noqa: F401
    embeddings_task,
    enrich_task,
    geocode_task,
    health_task,
    import_task,
    normalize_ai_task,
    parsing,
    subscriptions_task,
)
