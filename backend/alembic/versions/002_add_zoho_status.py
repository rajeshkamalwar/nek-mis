"""Add zoho_status and published_at to pipeline_runs."""

from alembic import op
import sqlalchemy as sa

revision = "002_add_zoho_status"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pipeline_runs", sa.Column("zoho_status", sa.String(20), nullable=True))
    op.add_column("pipeline_runs", sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("pipeline_runs", "published_at")
    op.drop_column("pipeline_runs", "zoho_status")
