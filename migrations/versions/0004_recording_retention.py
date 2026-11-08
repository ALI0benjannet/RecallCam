"""Global opt-in retention and durable worker deletion markers."""

import sqlalchemy as sa
from alembic import op

revision = "0004_recording_retention"
down_revision = "0003_playback_preparation"
branch_labels = None
depends_on = None


def upgrade():
    policy = op.create_table(
        "retention_policy",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("retention_days", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
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
        sa.CheckConstraint("id = 1", name="singleton"),
        sa.CheckConstraint("retention_days BETWEEN 1 AND 3650", name="retention_days_range"),
        sa.CheckConstraint("revision >= 1", name="revision_positive"),
    )
    op.bulk_insert(policy, [{"id": 1, "enabled": False, "retention_days": 30, "revision": 1}])
    op.add_column("videos", sa.Column("retention_policy_revision", sa.Integer(), nullable=True))
    op.create_index(
        "ix_videos_retention_ready",
        "videos",
        ["recording_end", "video_id"],
        postgresql_where=sa.text("upload_state = 'ready'"),
    )
    op.create_index(
        "ix_videos_retention_pending",
        "videos",
        ["updated_at", "video_id"],
        postgresql_where=sa.text(
            "upload_state = 'deleting' AND retention_policy_revision IS NOT NULL"
        ),
    )


def downgrade():
    op.drop_index("ix_videos_retention_pending", table_name="videos")
    op.drop_index("ix_videos_retention_ready", table_name="videos")
    op.drop_column("videos", "retention_policy_revision")
    op.drop_table("retention_policy")
