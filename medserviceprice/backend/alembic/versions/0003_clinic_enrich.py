"""clinic enrichment: photo/socials/place fields + clinic_reviews table

Revision ID: 0003_clinic_enrich
Revises: 0002_subscription_notify
Create Date: 2026-06-27
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, UUID

revision: str = "0003_clinic_enrich"
down_revision: Union[str, None] = "0002_subscription_notify"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("clinics", sa.Column("photo_url", sa.Text(), nullable=True))
    op.add_column(
        "clinics",
        sa.Column("socials", ARRAY(sa.Text()), nullable=False, server_default="{}"),
    )
    op.add_column("clinics", sa.Column("place_id", sa.Text(), nullable=True))
    op.add_column("clinics", sa.Column("place_source", sa.Text(), nullable=True))
    op.add_column("clinics", sa.Column("place_synced_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "clinic_reviews",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", UUID(as_uuid=True), sa.ForeignKey("clinics.id"), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("external_id", sa.Text(), nullable=False),
        sa.Column("author_alias", sa.Text(), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("source", "external_id", name="uq_review_source_extid"),
    )
    op.create_index("idx_reviews_clinic", "clinic_reviews", ["clinic_id"])


def downgrade() -> None:
    op.drop_index("idx_reviews_clinic", table_name="clinic_reviews")
    op.drop_table("clinic_reviews")
    for col in ("place_synced_at", "place_source", "place_id", "socials", "photo_url"):
        op.drop_column("clinics", col)
