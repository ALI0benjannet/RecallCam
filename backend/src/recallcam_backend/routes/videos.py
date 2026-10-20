"""Private upload, library and playback API. Indexing intentionally remains unavailable."""

import asyncio
import hashlib
from datetime import UTC
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import UUID
from zoneinfo import ZoneInfo

import anyio
from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import AwareDatetime
from sqlalchemy import and_, func, or_, select
from starlette.concurrency import run_in_threadpool
from starlette.requests import ClientDisconnect

from recallcam_backend.dependencies import CurrentUser, DatabaseSession
from recallcam_backend.security import require_permission
from recallcam_backend.services.audit import record_audit
from recallcam_backend.services.playback import read_preparation, request_preparation
from recallcam_shared.media import InvalidMedia, MediaToolUnavailable
from recallcam_backend.services.videos import (
    claim_upload,
    fail_upload,
    finish_upload,
    read_video,
    visible_video,
)
from recallcam_shared.contracts.access import Permission, Role
from recallcam_shared.contracts.videos import (
    VIDEO_TYPES,
    PlaybackRead,
    PlaybackPreparationRead,
    UploadPolicy,
    UploadState,
    VideoCreate,
    VideoPage,
    VideoRead,
    VideoUpdate,
)
from recallcam_shared.database.models import Artifact, Camera, Video
from recallcam_shared.storage.s3 import S3Storage, StorageUnavailable

router = APIRouter(prefix="/videos", tags=["recordings"])


@router.get("/upload-policy", response_model=UploadPolicy)
@require_permission(Permission.VIDEOS_MANAGE)
def upload_policy(request: Request) -> UploadPolicy:
    settings = request.app.state.settings
    return UploadPolicy(
        max_bytes=settings.upload_max_bytes,
        extensions=list(VIDEO_TYPES),
        timeout_seconds=settings.upload_timeout_seconds,
    )


@router.post("", status_code=201, response_model=VideoRead)
@require_permission(Permission.VIDEOS_MANAGE)
def create_video(
    body: VideoCreate, request: Request, current: CurrentUser, session: DatabaseSession
) -> VideoRead:
    settings = request.app.state.settings
    S3Storage(settings)  # Reject an unsupported storage setup before creating an unusable draft.
    if body.expected_byte_size > settings.upload_max_bytes:
        raise HTTPException(
            status_code=413, detail="The selected file exceeds the configured upload limit."
        )
    camera = session.get(Camera, body.camera_id)
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found.")
    if not camera.is_active:
        raise HTTPException(status_code=409, detail="Choose an active camera for this recording.")
    if (
        body.recording_start.utcoffset()
        != body.recording_start.astimezone(ZoneInfo(camera.timezone)).utcoffset()
    ):
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "loc": ["body", "recording_start"],
                    "msg": "The timestamp offset does not match the camera timezone on this date.",
                }
            ],
        )
    video = Video(
        camera_id=camera.camera_id,
        uploaded_by=current.user_id,
        title=body.title,
        description=body.description,
        original_filename=body.original_filename,
        expected_byte_size=body.expected_byte_size,
        content_type=VIDEO_TYPES[Path(body.original_filename).suffix.lower()],
        source_bucket=settings.s3_bucket,
        recording_start=body.recording_start.astimezone(UTC),
        recording_timezone=camera.timezone,
    )
    session.add(video)
    session.flush()
    record_audit(
        session,
        actor_id=current.user_id,
        action="video.registered",
        resource_type="video",
        resource_id=video.video_id,
        details={"camera_id": str(camera.camera_id)},
    )
    session.commit()
    session.refresh(video)
    return read_video(session, video, camera)


@router.get("", response_model=VideoPage)
@require_permission(Permission.FOOTAGE_READ)
def list_videos(
    request: Request,
    response: Response,
    current: CurrentUser,
    session: DatabaseSession,
    search: str = Query(default="", max_length=200),
    camera_id: UUID | None = None,
    upload_state: UploadState | None = None,
    start_from: AwareDatetime | None = None,
    end_before: AwareDatetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> VideoPage:
    if start_from and end_before and start_from >= end_before:
        raise HTTPException(status_code=422, detail="The period end must be later than its start.")
    filters = []
    if current.role != Role.ADMINISTRATOR:
        filters.append(Video.upload_state == "ready")
    if upload_state:
        filters.append(Video.upload_state == upload_state)
    if camera_id:
        filters.append(Video.camera_id == camera_id)
    if search.strip():
        pattern = f"%{search.strip()}%"
        filters.append(
            or_(
                Video.title.ilike(pattern),
                Video.original_filename.ilike(pattern),
                Camera.name.ilike(pattern),
                Camera.location.ilike(pattern),
            )
        )
    if start_from:
        filters.append(
            or_(
                Video.recording_end > start_from,
                and_(Video.recording_end.is_(None), Video.recording_start >= start_from),
            )
        )
    if end_before:
        filters.append(Video.recording_start < end_before)
    total = (
        session.scalar(select(func.count()).select_from(Video).join(Camera).where(*filters)) or 0
    )
    rows = session.execute(
        select(Video, Camera)
        .join(Camera)
        .where(*filters)
        .order_by(Video.recording_start.desc(), Video.video_id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [read_video(session, video, camera) for video, camera in rows]
    if items:
        thumbnails = session.scalars(
            select(Artifact).where(
                Artifact.video_id.in_([item.video_id for item in items]),
                Artifact.kind == "thumbnail",
            )
        )
        by_video = {artifact.video_id: artifact for artifact in thumbnails}
        store = S3Storage(request.app.state.settings) if by_video else None
        for item in items:
            thumbnail = by_video.get(item.video_id)
            if thumbnail and store and item.upload_state == "ready":
                item.thumbnail_url = store.signed_read(
                    thumbnail.bucket, thumbnail.object_key, thumbnail.content_type
                )
    response.headers["Cache-Control"] = "no-store"
    return VideoPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/{video_id}", response_model=VideoRead)
@require_permission(Permission.FOOTAGE_READ)
def get_video(video_id: UUID, current: CurrentUser, session: DatabaseSession) -> VideoRead:
    return read_video(session, visible_video(session, video_id, current))


@router.put("/{video_id}/content", response_model=VideoRead)
@require_permission(Permission.VIDEOS_MANAGE)
async def upload_content(video_id: UUID, request: Request, current: CurrentUser) -> VideoRead:
    settings = request.app.state.settings
    factory = request.app.state.session_factory
    ticket = await run_in_threadpool(claim_upload, factory, video_id, current, settings)
    temporary = None
    try:
        declared = request.headers.get("content-length")
        if declared and (not declared.isdigit() or int(declared) != ticket.expected_bytes):
            raise HTTPException(
                status_code=400, detail="The upload size does not match the registered file."
            )
        scratch = settings.data_dir / "uploads"
        await run_in_threadpool(scratch.mkdir, parents=True, exist_ok=True)
        temporary = TemporaryDirectory(prefix="recording-", dir=scratch)
        path = Path(temporary.name) / f"source{ticket.suffix}"
        size = 0
        checksum = hashlib.sha256()
        async with asyncio.timeout(settings.upload_timeout_seconds):
            with path.open("wb") as target:
                async for chunk in request.stream():
                    size += len(chunk)
                    if size > min(ticket.expected_bytes, settings.upload_max_bytes):
                        raise HTTPException(
                            status_code=413,
                            detail="The upload exceeds the registered or configured size.",
                        )
                    checksum.update(chunk)
                    await run_in_threadpool(target.write, chunk)
        if size != ticket.expected_bytes:
            raise HTTPException(
                status_code=400, detail="The upload is incomplete. Retry with the original file."
            )
        # Never remove scratch files while the managed storage transfer is still reading them.
        finishing = asyncio.create_task(
            run_in_threadpool(
                finish_upload, factory, ticket, path, checksum.hexdigest(), current, settings
            )
        )
        try:
            return await asyncio.shield(finishing)
        except asyncio.CancelledError:
            with anyio.CancelScope(shield=True):
                await finishing
            raise
    except (Exception, asyncio.CancelledError) as error:
        message = (
            error.detail
            if isinstance(error, HTTPException) and isinstance(error.detail, str)
            else (
                str(error)
                if isinstance(error, (InvalidMedia, MediaToolUnavailable, StorageUnavailable))
                else "Upload interrupted or unavailable. Retry with the original file."
            )
        )
        with anyio.CancelScope(shield=True):
            await run_in_threadpool(fail_upload, factory, ticket, message)
        if isinstance(error, TimeoutError):
            raise HTTPException(
                status_code=408, detail="Upload time limit exceeded. Retry the upload."
            ) from error
        if isinstance(error, ClientDisconnect):
            raise HTTPException(
                status_code=400, detail="Upload interrupted. Retry with the original file."
            ) from error
        if isinstance(error, OSError):
            raise HTTPException(
                status_code=507, detail="Upload scratch storage is unavailable or full."
            ) from error
        raise
    finally:
        if temporary:
            with anyio.CancelScope(shield=True):
                await run_in_threadpool(temporary.cleanup)


@router.patch("/{video_id}", response_model=VideoRead)
@require_permission(Permission.VIDEOS_MANAGE)
def update_video(
    video_id: UUID, body: VideoUpdate, current: CurrentUser, session: DatabaseSession
) -> VideoRead:
    video = visible_video(session, video_id, current, lock=True)
    if video.upload_state == "deleting":
        raise HTTPException(status_code=409, detail="This recording is being deleted.")
    changes = body.model_dump(exclude_unset=True)
    if not changes or ("title" in changes and changes["title"] is None):
        raise HTTPException(
            status_code=400, detail="Provide a nonempty title or description change."
        )
    for field, value in changes.items():
        setattr(video, field, value)
    record_audit(
        session,
        actor_id=current.user_id,
        action="video.updated",
        resource_type="video",
        resource_id=video_id,
        details={"changed_fields": sorted(changes)},
    )
    session.commit()
    session.refresh(video)
    return read_video(session, video)


@router.post("/{video_id}/playback", response_model=PlaybackRead)
@require_permission(Permission.FOOTAGE_READ)
def playback(
    video_id: UUID,
    request: Request,
    response: Response,
    current: CurrentUser,
    session: DatabaseSession,
) -> PlaybackRead:
    video = visible_video(session, video_id, current)
    if video.upload_state != "ready" or not video.object_key:
        raise HTTPException(status_code=409, detail="The recording is not ready for playback.")
    store = S3Storage(request.app.state.settings)
    thumbnail = session.scalar(
        select(Artifact)
        .where(Artifact.video_id == video_id, Artifact.kind == "thumbnail")
        .order_by(Artifact.created_at.desc())
        .limit(1)
    )
    rendition = session.scalar(
        select(Artifact).where(Artifact.video_id == video_id, Artifact.kind == "playback")
    )
    result = PlaybackRead(
        url=store.signed_read(
            rendition.bucket if rendition else video.source_bucket,
            rendition.object_key if rendition else video.object_key,
            rendition.content_type if rendition else video.content_type,
        ),
        thumbnail_url=(
            store.signed_read(thumbnail.bucket, thumbnail.object_key, thumbnail.content_type)
            if thumbnail
            else None
        ),
        expires_in=store.ttl,
        content_type=rendition.content_type if rendition else video.content_type,
        rendition="playback" if rendition else "original",
    )
    record_audit(
        session,
        actor_id=current.user_id,
        action="video.playback_authorized",
        resource_type="video",
        resource_id=video_id,
        details={"rendition": result.rendition},
    )
    session.commit()
    response.headers["Cache-Control"] = "no-store"
    return result


@router.get("/{video_id}/playback-preparation", response_model=PlaybackPreparationRead)
@require_permission(Permission.FOOTAGE_READ)
def preparation_status(
    video_id: UUID, response: Response, current: CurrentUser, session: DatabaseSession
) -> PlaybackPreparationRead:
    visible_video(session, video_id, current)
    response.headers["Cache-Control"] = "no-store"
    return read_preparation(session, video_id)


@router.post(
    "/{video_id}/playback-preparation", status_code=202, response_model=PlaybackPreparationRead
)
@require_permission(Permission.VIDEOS_MANAGE)
def prepare_playback(
    video_id: UUID,
    request: Request,
    response: Response,
    current: CurrentUser,
    session: DatabaseSession,
) -> PlaybackPreparationRead:
    response.headers["Cache-Control"] = "no-store"
    return request_preparation(session, video_id, current, request.app.state.settings)


@router.delete("/{video_id}", status_code=204)
@require_permission(Permission.VIDEOS_MANAGE)
def delete_video(
    video_id: UUID, request: Request, current: CurrentUser, session: DatabaseSession
) -> Response:
    store = S3Storage(request.app.state.settings)
    video = visible_video(session, video_id, current, lock=True)
    # Invalidates an incomplete attempt immediately. Final storage writes use the same row
    # lock, so deletion waits for an ongoing finalization or prevents it from starting.
    video.upload_state = "deleting"
    record_audit(
        session,
        actor_id=current.user_id,
        action="video.deletion_requested",
        resource_type="video",
        resource_id=video_id,
    )
    session.commit()
    # Reacquire the lock after persisting intent. Storage failure leaves a retryable deleting row.
    video = visible_video(session, video_id, current, lock=True)
    store.delete_prefix(video.source_bucket, f"videos/{video_id}/")
    session.delete(video)
    record_audit(
        session,
        actor_id=current.user_id,
        action="video.deleted",
        resource_type="video",
        resource_id=video_id,
    )
    session.commit()
    return Response(status_code=204)
