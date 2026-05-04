"""Initial schema: mapping + pipeline core."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_key", sa.String(50), nullable=False),
    )
    op.create_table(
        "mapping_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_key", sa.String(50), nullable=False),
        sa.Column("profile_name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_mapping_profiles_source_key", "mapping_profiles", ["source_key"])

    op.create_table(
        "mapping_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("canonical_key", sa.String(100), nullable=False),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("zoho_account_id", sa.String(100), nullable=False),
        sa.Column("zoho_account_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("document_kind", sa.String(40), nullable=False),
        sa.Column("formula_expr", sa.Text(), nullable=True),
        sa.Column("tax_rate", sa.String(20), nullable=True),
        sa.Column("sign_hint", sa.String(20), nullable=False, server_default="auto"),
        sa.Column("condition_expr", postgresql.JSONB(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["profile_id"], ["mapping_profiles.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("profile_id", "canonical_key", name="uq_mapping_rules_profile_key"),
    )
    op.create_index("ix_mapping_rules_profile_id", "mapping_rules", ["profile_id"])

    op.create_table(
        "csv_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sources.id"), nullable=False),
    )
    op.create_table(
        "pipeline_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("csv_file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("csv_files.id"), nullable=False),
        sa.Column("status", sa.String(20), server_default="running"),
        sa.Column("total_rows", sa.Integer(), server_default="0"),
        sa.Column("processed_rows", sa.Integer(), server_default="0"),
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("mapping_profiles.id"),
            nullable=True,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "csv_rows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("csv_file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("csv_files.id"), nullable=False),
        sa.Column("pipeline_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pipeline_runs.id"), nullable=True),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sources.id"), nullable=False),
        sa.Column("raw_hash", sa.String(64), nullable=False),
        sa.Column("raw_data", postgresql.JSONB(), nullable=False),
        sa.Column("mapped_data", postgresql.JSONB(), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending"),
    )
    op.create_table(
        "zoho_publishes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("csv_row_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("csv_rows.id"), nullable=False),
        sa.Column("zoho_entity_type", sa.String(30), nullable=False),
        sa.Column("zoho_entity_id", sa.String(100), nullable=True),
        sa.Column("idempotency_key", sa.String(100), nullable=False, unique=True),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("retry_count", sa.Integer(), server_default="0"),
        sa.Column("response_payload", postgresql.JSONB(), nullable=True),
        sa.Column("error_detail", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("zoho_publishes")
    op.drop_table("csv_rows")
    op.drop_table("pipeline_runs")
    op.drop_table("csv_files")
    op.drop_table("mapping_rules")
    op.drop_table("mapping_profiles")
    op.drop_table("sources")
