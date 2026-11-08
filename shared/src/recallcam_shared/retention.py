"""Shared selection policy for admin previews and worker execution."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from recallcam_shared.database.models import MediaJob, Video

RETENTION_POLICY_ID = 1


def expiry_cutoff(days: int) -> datetime:
    return datetime.now(UTC) - timedelta(days=days)


def expiry_conditions(cutoff: datetime):
    active_playback = (
        select(MediaJob.job_id)
        .where(MediaJob.video_id == Video.video_id, MediaJob.status.in_(("queued", "running")))
        .exists()
    )
    return (
        Video.upload_state == "ready",
        Video.recording_end <= cutoff,
        ~active_playback,
    )


def pending_retention_deletion():
    return (Video.upload_state == "deleting", Video.retention_policy_revision.is_not(None))
