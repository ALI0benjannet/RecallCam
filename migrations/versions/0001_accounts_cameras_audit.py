"""Accounts, camera metadata and application audit events.

Revision ID: 0001_accounts_cameras_audit
Revises: none
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_accounts_cameras_audit"
down_revision = None
branch_labels = None
depends_on = None


def version_columns() -> list[sa.Column]:
    return [
        sa.Column("schema_version", sa.String(16), nullable=False, server_default="1.0"),
        sa.Column(
            "producer_version", sa.String(80), nullable=False, server_default="recallcam-app/0.1.0"
        ),
    ]


def timestamp_columns() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    ]


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", sa.String(24), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("auth_version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        *version_columns(),
        *timestamp_columns(),
        sa.CheckConstraint(
            "role IN ('operator', 'supervisor', 'administrator')", name=op.f("ck_users_role_values")
        ),
        sa.CheckConstraint("auth_version >= 0", name=op.f("ck_users_auth_version_nonnegative")),
        sa.CheckConstraint("email = lower(email)", name=op.f("ck_users_email_normalized")),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.user_id"], name="fk_users_created_by_users", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("user_id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_role_is_active", "users", ["role", "is_active"])
    op.create_table(
        "cameras",
        sa.Column("camera_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("location", sa.String(200), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("timezone", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        *version_columns(),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.user_id"], name="fk_cameras_created_by_users", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("camera_id", name="pk_cameras"),
    )
    op.create_index("ix_cameras_is_active_name", "cameras", ["is_active", "name"])
    op.create_table(
        "audit_events",
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(80), nullable=False),
        sa.Column("resource_id", sa.String(100), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("details", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        *version_columns(),
        sa.ForeignKeyConstraint(
            ["actor_id"], ["users.user_id"], name="fk_audit_events_actor_id_users", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("event_id", name="pk_audit_events"),
    )
    op.create_index("ix_audit_events_occurred_at", "audit_events", ["occurred_at"])
    op.create_index("ix_audit_events_actor_id_occurred_at", "audit_events", ["actor_id", "occurred_at"])


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_table("cameras")
    op.drop_table("users")
