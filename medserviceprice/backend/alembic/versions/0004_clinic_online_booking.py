"""add has_online_booking to clinics (TZ §3.3 filter)

Revision ID: 0004_clinic_online_booking
Revises: 0003_clinic_enrich
Create Date: 2026-06-27
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_clinic_online_booking"
down_revision: Union[str, None] = "0003_clinic_enrich"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "clinics",
        sa.Column("has_online_booking", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("clinics", "has_online_booking")
