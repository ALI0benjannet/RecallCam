"""Application metadata only; indexing and investigation tables follow later migrations."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


class VersionedRecord:
    schema_version: Mapped[str] = mapped_column(String(16), default="1.0", server_default="1.0")
    producer_version: Mapped[str] = mapped_column(
        String(80), default="recallcam-app/0.1.0", server_default="recallcam-app/0.1.0"
    )


class TimestampedRecord:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class User(VersionedRecord, TimestampedRecord, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('operator', 'supervisor', 'administrator')", name="role_values"
        ),
        CheckConstraint("auth_version >= 0", name="auth_version_nonnegative"),
        CheckConstraint("email = lower(email)", name="email_normalized"),
        Index("ix_users_role_is_active", "role", "is_active"),
    )

    user_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    display_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(24))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    auth_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_by: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.user_id", ondelete="SET NULL")
    )


class Camera(VersionedRecord, TimestampedRecord, Base):
    __tablename__ = "cameras"
    __table_args__ = (Index("ix_cameras_is_active_name", "is_active", "name"),)

    camera_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(120))
    location: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    timezone: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_by: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.user_id", ondelete="SET NULL")
    )


class AuditEvent(VersionedRecord, Base):
    __tablename__ = "audit_events"
    __table_args__ = (
        Index("ix_audit_events_occurred_at", "occurred_at"),
        Index("ix_audit_events_actor_id_occurred_at", "actor_id", "occurred_at"),
    )

    event_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    actor_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.user_id", ondelete="SET NULL")
    )
    action: Mapped[str] = mapped_column(String(100))
    resource_type: Mapped[str] = mapped_column(String(80))
    resource_id: Mapped[str | None] = mapped_column(String(100))
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    details: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
