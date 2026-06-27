"""Read application logs back from Elasticsearch for the admin Logs panel.

Returns (entries, available). `available` is False when ES is disabled, the client
isn't installed, or the cluster is unreachable — the admin UI shows a hint instead
of erroring. This is a sync function; call it via run_in_threadpool from FastAPI.
"""
from __future__ import annotations

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

_LEVELS = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}


def query_logs(
    *,
    level: str | None = None,
    source: str | None = None,
    q: str | None = None,
    since_minutes: int = 60,
    limit: int = 100,
) -> tuple[list[dict], bool]:
    if not settings.elastic_enabled:
        return [], False
    try:
        from elasticsearch import Elasticsearch
    except Exception:
        return [], False

    kwargs: dict = {"request_timeout": 5, "retry_on_timeout": False}
    if settings.elastic_user:
        kwargs["basic_auth"] = (settings.elastic_user, settings.elastic_password)

    must: list[dict] = [{"range": {"@timestamp": {"gte": f"now-{max(1, since_minutes)}m"}}}]
    if level and level.upper() in _LEVELS:
        must.append({"term": {"level": level.upper()}})
    if source:
        must.append({"wildcard": {"source_key": f"*{source.lower()}*"}})
    if q:
        must.append({"match": {"message": q}})

    body = {
        "query": {"bool": {"must": must}},
        "sort": [{"@timestamp": {"order": "desc"}}],
        "size": min(max(1, limit), 500),
    }
    try:
        es = Elasticsearch(settings.elasticsearch_url, **kwargs)
        res = es.search(index=f"{settings.elastic_index}-*", body=body)
        hits = res.get("hits", {}).get("hits", [])
        return [h.get("_source", {}) for h in hits], True
    except Exception as exc:  # cluster down / index missing
        logger.warning("[elk] log query failed: %s", exc)
        return [], False
