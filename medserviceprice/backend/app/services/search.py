"""Service search (TZ §6.3): lexical (pg_trgm) + semantic (pgvector) + hybrid (RRF).

Lexical always works. Semantic kicks in only when ENABLE_SEMANTIC is true and the
catalog has embeddings; otherwise hybrid gracefully collapses to lexical.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import bindparam, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ServiceCatalog, ServiceOffer
from app.services.embeddings import embed_query_cached
from app.services.normalization import normalize_string

RRF_K = 60  # reciprocal-rank-fusion constant


@dataclass
class SearchHit:
    id: uuid.UUID
    name_norm: str
    category: str
    score: float


async def _lexical(db: AsyncSession, q: str, limit: int) -> list[tuple[uuid.UUID, str, str, float]]:
    """Trigram similarity over name_norm + synonyms (TZ §6.3)."""
    norm = normalize_string(q)
    # similarity() on name_norm; also catch synonym array membership/ILIKE.
    stmt = text(
        """
        SELECT id, name_norm, category,
               GREATEST(
                 similarity(lower(name_norm), :q),
                 COALESCE((
                   SELECT MAX(similarity(lower(s), :q))
                   FROM unnest(synonyms) AS s
                 ), 0)
               ) AS score
        FROM services_catalog
        WHERE lower(name_norm) % :q
           OR EXISTS (SELECT 1 FROM unnest(synonyms) AS s WHERE lower(s) % :q)
           OR lower(name_norm) ILIKE :like
        ORDER BY score DESC
        LIMIT :limit
        """
    ).bindparams(bindparam("q", norm), bindparam("like", f"%{norm}%"), bindparam("limit", limit))
    rows = (await db.execute(stmt)).all()
    return [(r[0], r[1], r[2], float(r[3])) for r in rows]


async def _semantic(
    db: AsyncSession, vec: list[float], limit: int
) -> list[tuple[uuid.UUID, str, str, float]]:
    """Cosine nearest neighbours via pgvector HNSW (TZ §6.3)."""
    stmt = text(
        """
        SELECT id, name_norm, category,
               1 - (embedding <=> CAST(:vec AS vector)) AS score
        FROM services_catalog
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> CAST(:vec AS vector)
        LIMIT :limit
        """
    ).bindparams(bindparam("vec", str(vec)), bindparam("limit", limit))
    rows = (await db.execute(stmt)).all()
    return [(r[0], r[1], r[2], float(r[3])) for r in rows]


def _rrf(rankings: list[list[tuple[uuid.UUID, str, str, float]]]) -> list[SearchHit]:
    """Reciprocal Rank Fusion of multiple ranked lists."""
    agg: dict[uuid.UUID, dict] = {}
    for ranking in rankings:
        for rank, (sid, name, cat, _score) in enumerate(ranking):
            slot = agg.setdefault(sid, {"name": name, "cat": cat, "score": 0.0})
            slot["score"] += 1.0 / (RRF_K + rank + 1)
    hits = [SearchHit(sid, v["name"], v["cat"], v["score"]) for sid, v in agg.items()]
    hits.sort(key=lambda h: h.score, reverse=True)
    return hits


async def search_services(
    db: AsyncSession, q: str, mode: str = "hybrid", limit: int = 8
) -> list[SearchHit]:
    if not q or not q.strip():
        return []

    lexical = await _lexical(db, q, limit * 2)

    if mode == "lexical":
        return [SearchHit(*r) for r in lexical[:limit]]

    vec = await embed_query_cached(q)
    semantic = await _semantic(db, vec, limit * 2) if vec else []

    if mode == "semantic":
        if semantic:
            return [SearchHit(*r) for r in semantic[:limit]]
        return [SearchHit(*r) for r in lexical[:limit]]  # graceful fallback

    # hybrid (default): fuse whatever signals we have
    rankings = [r for r in (lexical, semantic) if r]
    if not rankings:
        return []
    if len(rankings) == 1:
        return [SearchHit(*r) for r in rankings[0][:limit]]
    return _rrf(rankings)[:limit]


async def attach_offer_stats(
    db: AsyncSession, hits: list[SearchHit]
) -> list[tuple[SearchHit, int, float | None]]:
    """For each hit, count active offers + min price (for the autocomplete UI)."""
    out: list[tuple[SearchHit, int, float | None]] = []
    for h in hits:
        row = (
            await db.execute(
                select(func.count(ServiceOffer.id), func.min(ServiceOffer.price_kzt)).where(
                    ServiceOffer.service_id == h.id, ServiceOffer.is_active.is_(True)
                )
            )
        ).one()
        out.append((h, int(row[0] or 0), float(row[1]) if row[1] is not None else None))
    return out
