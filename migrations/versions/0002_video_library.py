"""Private recording library and file references. No indexing jobs.

Revision ID: 0002_video_library
Revises: 0001_accounts_cameras_audit
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_video_library"
down_revision = "0001_accounts_cameras_audit"
branch_labels = None
depends_on = None


def record_columns():
    return [
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
    ]


def upgrade():
    op.create_table(
        "videos",
        sa.Column("video_id", sa.Uuid(), primary_key=True),
        sa.Column(
            "camera_id",
            sa.Uuid(),
            sa.ForeignKey("cameras.camera_id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "uploaded_by",
            sa.Uuid(),
            sa.ForeignKey("users.user_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("expected_byte_size", sa.BigInteger(), nullable=False),
        sa.Column("byte_size", sa.BigInteger(), nullable=True),
        sa.Column("sha256", sa.String(64), nullable=True),
        sa.Column("source_bucket", sa.String(200), nullable=False),
        sa.Column("object_key", sa.String(512), nullable=True),
        sa.Column("upload_state", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("metadata_state", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("thumbnail_state", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("upload_attempt_id", sa.Uuid(), nullable=True),
        sa.Column("upload_lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recording_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recording_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recording_timezone", sa.String(100), nullable=False),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("frame_rate", sa.Float(), nullable=True),
        sa.Column("video_codec", sa.String(80), nullable=True),
        sa.Column("last_error", sa.String(300), nullable=True),
        *record_columns(),
        sa.CheckConstraint("expected_byte_size > 0", name="expected_size_positive"),
        sa.CheckConstraint("byte_size IS NULL OR byte_size > 0", name="size_positive"),
        sa.CheckConstraint(
            "duration_seconds IS NULL OR duration_seconds > 0", name="duration_positive"
        ),
        sa.CheckConstraint("width IS NULL OR width > 0", name="width_positive"),
        sa.CheckConstraint("height IS NULL OR height > 0", name="height_positive"),
        sa.CheckConstraint("frame_rate IS NULL OR frame_rate > 0", name="frame_rate_positive"),
        sa.CheckConstraint(
            "recording_end IS NULL OR recording_end > recording_start", name="timeline_order"
        ),
        sa.CheckConstraint(
            "upload_state IN ('pending', 'uploading', 'ready', 'failed', 'deleting')",
            name="upload_state_values",
        ),
        sa.CheckConstraint(
            "metadata_state IN ('pending', 'ready', 'failed')", name="metadata_state_values"
        ),
        sa.CheckConstraint(
            "thumbnail_state IN ('pending', 'ready', 'failed')", name="thumbnail_state_values"
        ),
        sa.CheckConstraint(
            "upload_state != 'ready' OR (object_key IS NOT NULL AND byte_size IS NOT NULL AND metadata_state = 'ready' AND recording_end IS NOT NULL)",
            name="ready_has_source",
        ),
    )
    op.create_index("ix_videos_camera_recording_start", "videos", ["camera_id", "recording_start"])
    op.create_index("ix_videos_upload_state_created_at", "videos", ["upload_state", "created_at"])
    op.create_table(
        "artifacts",
        sa.Column("artifact_id", sa.Uuid(), primary_key=True),
        sa.Column(
            "video_id",
            sa.Uuid(),
            sa.ForeignKey("videos.video_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("bucket", sa.String(200), nullable=False),
        sa.Column("object_key", sa.String(512), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("byte_size", sa.BigInteger(), nullable=False),
        *record_columns(),
        sa.UniqueConstraint("video_id", "object_key", name="uq_artifacts_video_object_key"),
        sa.CheckConstraint("byte_size > 0", name="size_positive"),
    )
    op.create_index("ix_artifacts_video_id_kind", "artifacts", ["video_id", "kind"])


def downgrade():
    op.drop_table("artifacts")
    op.drop_table("videos")
