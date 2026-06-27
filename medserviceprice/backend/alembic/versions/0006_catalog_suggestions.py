"""AI catalog suggestions (clustered from the unmatched queue, human-approved)

Revision ID: 0006_catalog_suggestions
Revises: 0005_alerts
Create Date: 2026-06-28
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_catalog_suggestions"
down_revision: Union[str, None] = "0005_alerts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "catalog_suggestions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("proposed_name_norm", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("synonyms", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("sample_count", sa.Integer(), server_default="0"),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("applied_service_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("services_catalog.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "category IN ('laboratory','doctor_visit','diagnostics','procedure')",
            name="ck_suggestion_category",
        ),
        sa.CheckConstraint("status IN ('pending','applied','rejected')", name="ck_suggestion_status"),
    )
    op.create_index("idx_suggestions_status", "catalog_suggestions", ["status", "sample_count"])


def downgrade() -> None:
    op.drop_index("idx_suggestions_status", table_name="catalog_suggestions")
    op.drop_table("catalog_suggestions")
