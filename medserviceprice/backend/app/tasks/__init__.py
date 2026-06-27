"""Celery tasks package."""
from app.tasks import (  # noqa: F401
    embeddings_task,
    geocode_task,
    import_task,
    parsing,
    subscriptions_task,
)
