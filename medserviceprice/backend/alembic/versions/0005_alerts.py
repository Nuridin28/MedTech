"""operational alerts table (parse failures / no records / stale sources)

Revision ID: 0005_alerts
Revises: 0004_clinic_online_booking
Create Date: 2026-06-28
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_alerts"
down_revision: Union[str, None] = "0004_clinic_online_booking"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_key", sa.Text(), nullable=False),
        sa.Column("severity", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("acknowledged", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("severity IN ('error','warning','info')", name="ck_alert_severity"),
    )
    op.create_index("idx_alerts_open", "alerts", ["acknowledged", "created_at"])
    op.create_index("idx_alerts_dedup", "alerts", ["source_key", "kind", "acknowledged"])


def downgrade() -> None:
    op.drop_index("idx_alerts_dedup", table_name="alerts")
    op.drop_index("idx_alerts_open", table_name="alerts")
    op.drop_table("alerts")
