"""Explicit playback requests; no transcoding in an API process."""

import logging
from uuid import UUID

from fastapi import HTTPException
from redis.exceptions import RedisError
from sqlalchemy import select
from sqlalchemy.orm import Session

from recallcam_backend.security import Principal
from recallcam_backend.services.audit import record_audit
from recallcam_backend.services.videos import visible_video
from recallcam_shared.contracts.videos import PlaybackPreparationRead
from recallcam_shared.database.models import Artifact, MediaJob
from recallcam_shared.media_queue import media_queue, publish_preparation, redis_connection
from recallcam_shared.settings import Settings


def read_preparation(session: Session, video_id: UUID) -> PlaybackPreparationRead:
    job = session.scalar(
        select(MediaJob)
        .where(MediaJob.video_id == video_id)
        .order_by(MediaJob.created_at.desc(), MediaJob.job_id.desc())
        .limit(1)
    )
    return PlaybackPreparationRead.model_validate(job) if job else PlaybackPreparationRead()


def request_preparation(
    session: Session, video_id: UUID, current: Principal, settings: Settings
) -> PlaybackPreparationRead:
    # Serialize duplicate clicks against deletion and other requests for this video.
    video = visible_video(session, video_id, current, lock=True)
    if video.upload_state != "ready" or not video.object_key or not video.sha256:
        raise HTTPException(status_code=409, detail="The original must finish uploading first.")
    existing = session.scalar(
        select(MediaJob).where(
            MediaJob.video_id == video_id, MediaJob.status.in_(["queued", "running"])
        )
    )
    if existing:
        return PlaybackPreparationRead.model_validate(existing)
    if session.scalar(
        select(Artifact.artifact_id).where(
            Artifact.video_id == video_id, Artifact.kind == "playback"
        )
    ):
        return read_preparation(session, video_id)
    job = MediaJob(
        video_id=video_id,
        requested_by=current.user_id,
        source_sha256=video.sha256,
        settings={
            "recipe": "h264-playback/1.1",
            "fps_mode": "vfr",
            "encoder_time_base": "1:90000",
            "video_track_timescale": 90000,
            "max_b_frames": 0,
            "crf": 18,
            "preset": "fast",
            "threads": settings.playback_conversion_threads,
            "timeout_seconds": settings.playback_conversion_timeout_seconds,
            "max_bytes": settings.playback_conversion_max_bytes,
        },
    )
    session.add(job)
    session.flush()
    record_audit(
        session,
        actor_id=current.user_id,
        action="video.playback_preparation_requested",
        resource_type="video",
        resource_id=video_id,
        details={"job_id": str(job.job_id)},
    )
    session.commit()  # Durable outbox first. A Redis outage must not lose this explicit request.
    result = PlaybackPreparationRead.model_validate(job)
    try:
        with redis_connection(settings) as client:
            publish_preparation(media_queue(client), job.job_id, job.settings["timeout_seconds"])
    except RedisError:
        logging.warning("Playback request saved; queue publication will be retried by the worker.")
    return result
