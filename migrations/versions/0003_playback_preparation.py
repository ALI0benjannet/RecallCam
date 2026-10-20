"""Explicit playback preparation jobs and one playback artifact per recording.

Revision ID: 0003_playback_preparation
Revises: 0002_video_library
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_playback_preparation"
down_revision = "0002_video_library"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "media_jobs",
        sa.Column("job_id", sa.Uuid(), primary_key=True),
        sa.Column(
            "video_id",
            sa.Uuid(),
            sa.ForeignKey("videos.video_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "requested_by",
            sa.Uuid(),
            sa.ForeignKey("users.user_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("kind", sa.String(40), nullable=False, server_default="prepare_playback"),
        sa.Column("status", sa.String(24), nullable=False, server_default="queued"),
        sa.Column("stage", sa.String(40), nullable=False, server_default="queued"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_sha256", sa.String(64), nullable=False),
        sa.Column("settings", postgresql.JSONB(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(300), nullable=True),
        sa.Column("schema_version", sa.String(16), nullable=False, server_default="1.0"),
        sa.Column(
            "producer_version", sa.String(80), nullable=False, server_default="recallcam-app/0.1.0"
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("kind = 'prepare_playback'", name="kind_values"),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'succeeded', 'failed')", name="status_values"
        ),
        sa.CheckConstraint("attempts >= 0", name="attempts_nonnegative"),
    )
    op.create_index("ix_media_jobs_status_created_at", "media_jobs", ["status", "created_at"])
    op.create_index("ix_media_jobs_video_created_at", "media_jobs", ["video_id", "created_at"])
    op.create_index(
        "uq_media_jobs_active_video",
        "media_jobs",
        ["video_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('queued', 'running')"),
    )
    op.create_index(
        "uq_artifacts_playback_video",
        "artifacts",
        ["video_id"],
        unique=True,
        postgresql_where=sa.text("kind = 'playback'"),
    )


def downgrade():
    op.drop_index("uq_artifacts_playback_video", table_name="artifacts")
    op.drop_table("media_jobs")
