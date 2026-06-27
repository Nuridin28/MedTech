"""Sentence-transformer embeddings for semantic search (TZ §6.3).

The model (multilingual MiniLM, 384-dim) is loaded lazily and cached on the worker.
Heavy (~470MB), so the API only loads it when ENABLE_SEMANTIC is true. Query
embeddings are cached in Redis by text hash (deterministic).
"""
from __future__ import annotations

import hashlib
import logging

from app.core.config import settings
from app.core.redis_client import cache_get, cache_set

logger = logging.getLogger(__name__)

_model = None


def _load_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer  # imported lazily

        logger.info("Loading embedding model %s ...", settings.embedding_model)
        _model = SentenceTransformer(settings.embedding_model)
    return _model


def embed_text(text: str) -> list[float]:
    """Synchronous embedding (used by the Celery worker for catalog vectors)."""
    model = _load_model()
    vec = model.encode(text, normalize_embeddings=True)
    return vec.tolist()


def embed_texts(texts: list[str]) -> list[list[float]]:
    model = _load_model()
    vecs = model.encode(texts, normalize_embeddings=True, batch_size=32)
    return [v.tolist() for v in vecs]


async def embed_query_cached(text: str) -> list[float] | None:
    """Embed a user query (online). Returns None if semantic search is disabled."""
    if not settings.enable_semantic:
        return None
    key = f"emb:{hashlib.sha256(text.lower().encode()).hexdigest()[:24]}"
    cached = await cache_get(key)
    if cached:
        return cached
    try:
        vec = embed_text(text)
    except Exception as exc:
        logger.warning("Query embedding failed, falling back to lexical: %s", exc)
        return None
    await cache_set(key, vec, settings.cache_ttl_fx)  # deterministic, long TTL
    return vec
