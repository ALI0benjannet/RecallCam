"""Application metadata only; indexing and investigation tables follow later migrations."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class User(VersionedRecord, TimestampedRecord, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('operator', 'supervisor', 'administrator')", name="role_values"),
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


class Video(VersionedRecord, TimestampedRecord, Base):
    """Stored recordings only. Indexing jobs and their states are deliberately separate."""

    __tablename__ = "videos"
    __table_args__ = (
        CheckConstraint("expected_byte_size > 0", name="expected_size_positive"),
        CheckConstraint("byte_size IS NULL OR byte_size > 0", name="size_positive"),
        CheckConstraint(
            "duration_seconds IS NULL OR duration_seconds > 0", name="duration_positive"
        ),
        CheckConstraint("width IS NULL OR width > 0", name="width_positive"),
        CheckConstraint("height IS NULL OR height > 0", name="height_positive"),
        CheckConstraint("frame_rate IS NULL OR frame_rate > 0", name="frame_rate_positive"),
        CheckConstraint(
            "recording_end IS NULL OR recording_end > recording_start", name="timeline_order"
        ),
        CheckConstraint(
            "upload_state IN ('pending', 'uploading', 'ready', 'failed', 'deleting')",
            name="upload_state_values",
        ),
        CheckConstraint(
            "metadata_state IN ('pending', 'ready', 'failed')", name="metadata_state_values"
        ),
        CheckConstraint(
            "thumbnail_state IN ('pending', 'ready', 'failed')", name="thumbnail_state_values"
        ),
        CheckConstraint(
            "upload_state != 'ready' OR (object_key IS NOT NULL AND byte_size IS NOT NULL AND metadata_state = 'ready' AND recording_end IS NOT NULL)",
            name="ready_has_source",
        ),
        Index("ix_videos_camera_recording_start", "camera_id", "recording_start"),
        Index("ix_videos_upload_state_created_at", "upload_state", "created_at"),
    )
    video_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    camera_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("cameras.camera_id", ondelete="RESTRICT")
    )
    uploaded_by: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.user_id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    original_filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    expected_byte_size: Mapped[int] = mapped_column(BigInteger)
    byte_size: Mapped[int | None] = mapped_column(BigInteger)
    sha256: Mapped[str | None] = mapped_column(String(64))
    source_bucket: Mapped[str] = mapped_column(String(200))
    object_key: Mapped[str | None] = mapped_column(String(512))
    upload_state: Mapped[str] = mapped_column(
        String(24), default="pending", server_default="pending"
    )
    metadata_state: Mapped[str] = mapped_column(
        String(24), default="pending", server_default="pending"
    )
    thumbnail_state: Mapped[str] = mapped_column(
        String(24), default="pending", server_default="pending"
    )
    upload_attempt_id: Mapped[UUID | None] = mapped_column(Uuid)
    upload_lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    recording_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    recording_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    recording_timezone: Mapped[str] = mapped_column(String(100))
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    frame_rate: Mapped[float | None] = mapped_column(Float)
    video_codec: Mapped[str | None] = mapped_column(String(80))
    last_error: Mapped[str | None] = mapped_column(String(300))


class Artifact(VersionedRecord, TimestampedRecord, Base):
    __tablename__ = "artifacts"
    __table_args__ = (
        UniqueConstraint("video_id", "object_key", name="uq_artifacts_video_object_key"),
        CheckConstraint("byte_size > 0", name="size_positive"),
        Index("ix_artifacts_video_id_kind", "video_id", "kind"),
        Index(
            "uq_artifacts_playback_video",
            "video_id",
            unique=True,
            postgresql_where=text("kind = 'playback'"),
        ),
    )
    artifact_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    video_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("videos.video_id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(40))
    bucket: Mapped[str] = mapped_column(String(200))
    object_key: Mapped[str] = mapped_column(String(512))
    content_type: Mapped[str] = mapped_column(String(100))
    byte_size: Mapped[int] = mapped_column(BigInteger)


class MediaJob(VersionedRecord, TimestampedRecord, Base):
    """Explicit playback preparation only; this is not an indexing job."""

    __tablename__ = "media_jobs"
    __table_args__ = (
        CheckConstraint("kind = 'prepare_playback'", name="kind_values"),
        CheckConstraint(
            "status IN ('queued', 'running', 'succeeded', 'failed')", name="status_values"
        ),
        CheckConstraint("attempts >= 0", name="attempts_nonnegative"),
        Index("ix_media_jobs_status_created_at", "status", "created_at"),
        Index("ix_media_jobs_video_created_at", "video_id", "created_at"),
        Index(
            "uq_media_jobs_active_video",
            "video_id",
            unique=True,
            postgresql_where=text("status IN ('queued', 'running')"),
        ),
    )

    job_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    video_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("videos.video_id", ondelete="CASCADE"))
    requested_by: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.user_id", ondelete="SET NULL")
    )
    kind: Mapped[str] = mapped_column(
        String(40), default="prepare_playback", server_default="prepare_playback"
    )
    status: Mapped[str] = mapped_column(String(24), default="queued", server_default="queued")
    stage: Mapped[str] = mapped_column(String(40), default="queued", server_default="queued")
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    source_sha256: Mapped[str] = mapped_column(String(64))
    settings: Mapped[dict] = mapped_column(JSONB)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(String(300))
