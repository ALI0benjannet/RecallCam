"""Recording upload/library operations. Explicit playback jobs are handled separately."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from recallcam_backend.security import Principal
from recallcam_backend.services.audit import record_audit
from recallcam_shared.media import InvalidMedia, create_thumbnail, probe_video
from recallcam_shared.contracts.access import Role
from recallcam_shared.contracts.videos import VideoRead
from recallcam_shared.database.models import Artifact, Camera, Video
from recallcam_shared.settings import Settings
from recallcam_shared.storage.s3 import S3Storage, StorageUnavailable


def visible_video(session: Session, video_id: UUID, current: Principal, *, lock=False) -> Video:
    video = session.get(Video, video_id, with_for_update=lock)
    if video is None or (current.role != Role.ADMINISTRATOR and video.upload_state != "ready"):
        raise HTTPException(status_code=404, detail="Recording not found.")
    return video


def read_video(session: Session, video: Video, camera: Camera | None = None) -> VideoRead:
    camera = camera or session.get(Camera, video.camera_id)
    fields = {
        name: getattr(video, name)
        for name in VideoRead.model_fields
        if name not in {"camera", "thumbnail_url"}
    }
    return VideoRead.model_validate({**fields, "camera": camera})


@dataclass(frozen=True)
class UploadTicket:
    video_id: UUID
    attempt_id: UUID
    expected_bytes: int
    suffix: str


def claim_upload(
    factory: sessionmaker, video_id: UUID, current: Principal, settings: Settings
) -> UploadTicket:
    with factory() as session:
        video = visible_video(session, video_id, current, lock=True)
        if video.upload_state in {"ready", "deleting"}:
            raise HTTPException(
                status_code=409, detail="This recording is already stored or being deleted."
            )
        now = datetime.now(UTC)
        if (
            video.upload_state == "uploading"
            and video.upload_lease_expires_at
            and video.upload_lease_expires_at > now
        ):
            raise HTTPException(
                status_code=409,
                detail="An upload is already in progress. Wait for it to finish or expire.",
            )
        camera = session.get(Camera, video.camera_id)
        if not camera or not camera.is_active:
            raise HTTPException(
                status_code=409,
                detail="The recording's camera is archived. Restore it before uploading.",
            )
        if video.expected_byte_size > settings.upload_max_bytes:
            raise HTTPException(
                status_code=413, detail="This file exceeds the configured upload limit."
            )
        attempt_id = uuid4()
        suffix = Path(video.original_filename).suffix.lower()
        video.upload_state = "uploading"
        video.metadata_state = "pending"
        video.thumbnail_state = "pending"
        video.upload_attempt_id = attempt_id
        video.upload_lease_expires_at = now + timedelta(seconds=settings.upload_timeout_seconds)
        video.object_key = f"videos/{video_id}/{attempt_id}/original{suffix}"
        video.last_error = None
        session.commit()
        return UploadTicket(video_id, attempt_id, video.expected_byte_size, suffix)


def fail_upload(factory: sessionmaker, ticket: UploadTicket, message: str) -> None:
    with factory() as session:
        video = session.get(Video, ticket.video_id, with_for_update=True)
        if (
            video
            and video.upload_state == "uploading"
            and video.upload_attempt_id == ticket.attempt_id
        ):
            video.upload_state = "failed"
            video.metadata_state = "failed"
            video.thumbnail_state = "failed"
            video.upload_lease_expires_at = None
            video.last_error = message[:300]
            session.commit()


def finish_upload(
    factory: sessionmaker,
    ticket: UploadTicket,
    path: Path,
    checksum: str,
    current: Principal,
    settings: Settings,
) -> VideoRead:
    info = probe_video(path, settings)
    preview = path.with_suffix(".jpg")
    has_preview = create_thumbnail(path, preview, settings)
    store = S3Storage(settings)
    with factory() as session:
        video = visible_video(session, ticket.video_id, current, lock=True)
        if video.upload_state != "uploading" or video.upload_attempt_id != ticket.attempt_id:
            raise HTTPException(status_code=409, detail="This upload attempt is no longer active.")
        if not video.upload_lease_expires_at or video.upload_lease_expires_at <= datetime.now(UTC):
            raise HTTPException(
                status_code=408, detail="Upload time limit exceeded. Retry the upload."
            )
        try:
            end = video.recording_start + timedelta(seconds=info.duration)
        except OverflowError as error:
            raise InvalidMedia(
                "The recording timeline exceeds the supported date range."
            ) from error
        if end <= video.recording_start:
            raise InvalidMedia(
                "The recording duration is too short for the supported timeline precision."
            )
        # Keep this row locked through object writes/final commit: delete or retry cannot race them.
        store.upload(path, video.source_bucket, video.object_key, video.content_type)
        if has_preview:
            key = f"videos/{video.video_id}/{ticket.attempt_id}/thumbnail.jpg"
            try:
                store.upload(preview, video.source_bucket, key, "image/jpeg")
                session.add(
                    Artifact(
                        video_id=video.video_id,
                        kind="thumbnail",
                        bucket=video.source_bucket,
                        object_key=key,
                        content_type="image/jpeg",
                        byte_size=preview.stat().st_size,
                    )
                )
            except StorageUnavailable:
                has_preview = False
        video.byte_size = ticket.expected_bytes
        video.sha256 = checksum
        video.duration_seconds = info.duration
        video.recording_end = end
        video.width, video.height = info.width, info.height
        video.frame_rate, video.video_codec = info.frame_rate, info.codec
        video.upload_state = "ready"
        video.metadata_state = "ready"
        video.thumbnail_state = "ready" if has_preview else "failed"
        video.upload_lease_expires_at = None
        video.last_error = None
        record_audit(
            session,
            actor_id=current.user_id,
            action="video.uploaded",
            resource_type="video",
            resource_id=video.video_id,
            details={"camera_id": str(video.camera_id), "byte_size": video.byte_size},
        )
        session.commit()
        session.refresh(video)
        return read_video(session, video)
