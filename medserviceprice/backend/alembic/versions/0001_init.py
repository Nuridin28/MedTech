"""initial schema: extensions, tables, trgm + hnsw indexes (TZ §4)

Revision ID: 0001_init
Revises:
Create Date: 2026-06-27
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.core.db import Base

# Import models so metadata is populated for create_all.
import app.models  # noqa: F401

revision: str = "0001_init"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1) Extensions (TZ §4.4) — vector must exist before the Vector column is created.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # 2) All ORM tables (mirrors models, incl. btree indexes from __table_args__).
    Base.metadata.create_all(bind=bind)

    # 3) Specialized search indexes that create_all doesn't know about (TZ §4.4).
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_catalog_name_trgm "
        "ON services_catalog USING gin (name_norm gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_catalog_synonyms "
        "ON services_catalog USING gin (synonyms)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_catalog_embedding "
        "ON services_catalog USING hnsw (embedding vector_cosine_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_catalog_embedding")
    op.execute("DROP INDEX IF EXISTS idx_catalog_synonyms")
    op.execute("DROP INDEX IF EXISTS idx_catalog_name_trgm")
    Base.metadata.drop_all(bind=op.get_bind())
