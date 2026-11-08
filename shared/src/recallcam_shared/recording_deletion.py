"""One storage and metadata deletion path for manual and retention deletions."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from recallcam_shared.database.models import AuditEvent, Video
from recallcam_shared.storage.s3 import S3Storage


def _audit_deletion(session: Session, video: Video, action: str, actor_id: UUID | None) -> None:
    revision = video.retention_policy_revision
    details = (
        {"reason": "retention", "policy_revision": revision}
        if revision is not None
        else {"reason": "manual"}
    )
    session.add(
        AuditEvent(
            actor_id=actor_id,
            action=action,
            resource_type="video",
            resource_id=str(video.video_id),
            details=details,
        )
    )


def mark_for_deletion(
    session: Session,
    video: Video,
    *,
    actor_id: UUID | None,
    retention_revision: int | None = None,
) -> None:
    """Caller holds the video row lock and commits intent before touching storage."""
    if video.upload_state == "deleting":
        return
    video.upload_state = "deleting"
    video.retention_policy_revision = retention_revision
    _audit_deletion(session, video, "video.deletion_requested", actor_id)


def purge_marked_recording(
    session: Session,
    storage: S3Storage,
    video_id: UUID,
    *,
    actor_id: UUID | None,
    retention_only: bool = False,
) -> bool:
    """Hold the video lock through object deletion and the caller's DB commit."""
    query = select(Video).where(Video.video_id == video_id, Video.upload_state == "deleting")
    if retention_only:
        query = query.where(Video.retention_policy_revision.is_not(None))
    video = session.scalar(query.with_for_update(skip_locked=retention_only))
    if video is None:
        return False

    # Current artifacts (original, thumbnail and playback copy) live in this prefix.
    # Extend this shared path before enabling indexing and its other representations.
    storage.delete_prefix(video.source_bucket, f"videos/{video_id}/")
    _audit_deletion(session, video, "video.deleted", actor_id)
    session.delete(video)
    return True
