"""add price-drop notification tracking to subscriptions (TZ §3.4)

Revision ID: 0002_subscription_notify
Revises: 0001_init
Create Date: 2026-06-27
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_subscription_notify"
down_revision: Union[str, None] = "0001_init"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("subscriptions", sa.Column("notified_price_kzt", sa.Numeric(12, 2), nullable=True))
    op.add_column(
        "subscriptions", sa.Column("last_notified_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("subscriptions", "last_notified_at")
    op.drop_column("subscriptions", "notified_price_kzt")
