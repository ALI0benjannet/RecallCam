"""Explicit playback conversion. Original footage and AI indexing are untouched."""

import hashlib
import logging
import re
import subprocess
import traceback
from collections import deque
from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from uuid import UUID

from sqlalchemy import select, text

from recallcam_shared.database.connection import create_database_engine, create_session_factory
from recallcam_shared.database.models import Artifact, AuditEvent, MediaJob, Video
from recallcam_shared.media import MEDIA_DEMUXERS, InvalidMedia, MediaToolUnavailable, probe_video
from recallcam_shared.media_queue import MEDIA_EXECUTION_LOCK
from recallcam_shared.settings import Settings
from recallcam_shared.storage.s3 import S3Storage, StorageUnavailable


class PlaybackPreparationFailed(Exception):
    """Safe RQ failure message, without credential-bearing exception chains."""


def _run_conversion(command: list[str], timeout: int) -> tuple[int, bytes]:
    """Drain stderr continuously, retaining only its last 64 KiB in memory."""
    tail: deque[bytes] = deque(maxlen=16)
    with subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE) as process:
        assert process.stderr is not None

        def drain() -> None:
            try:
                while chunk := process.stderr.read(4096):
                    tail.append(chunk)
            except (OSError, ValueError):
                pass  # The pipe may close during shutdown; no raw diagnostics escape.

        reader = Thread(target=drain, name="ffmpeg-stderr", daemon=True)
        reader.start()
        try:
            code = process.wait(timeout=timeout)
        finally:
            # Also stop FFmpeg on an RQ timeout/termination exception before
            # TemporaryDirectory cleanup removes its still-open output file.
            if process.poll() is None:
                process.kill()
            process.wait()
            reader.join()
    return code, b"".join(tail)


def _conversion_diagnostic(stderr: bytes, source: Path, output: Path) -> str:
    message = stderr.decode("utf-8", errors="replace")
    message = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", message)
    message = "".join(char for char in message if char in "\n\t" or char.isprintable())
    for path, replacement in (
        (source, "<original>"),
        (output, "<playback>"),
        (output.parent, "<scratch>"),
    ):
        message = message.replace(str(path), replacement)
    message = re.sub(r"(?i)\b(?:https?|rtsp|rtmp|ftp|s3|file)://[^\s]+", "<redacted-url>", message)
    message = re.sub(
        r"(?i)\b(?:authorization|password|secret|token|api[_-]?key|credential)\s*[:=]\s*[^\s]+",
        "<redacted-credential>",
        message,
    )
    return message.strip()[-4096:] or "No error output was provided."


def _conversion_failure_message(code: int, diagnostic: str) -> str:
    text = diagnostic.lower()
    if "unknown encoder" in text or "encoder not found" in text:
        return "The worker FFmpeg build is missing a required encoder. Rebuild/check its FFmpeg installation."
    if "unrecognized option" in text or "option not found" in text:
        return "The worker FFmpeg version does not support a conversion option. Check worker diagnostics."
    if "no space left" in text or "disk quota exceeded" in text:
        return "The worker ran out of scratch storage while preparing playback."
    if "permission denied" in text:
        return "FFmpeg cannot access worker scratch storage. Check its permissions."
    if "not on whitelist" in text:
        return "This input requires a format or protocol outside the permitted local-media policy."
    if "non-monotonous dts" in text or "non-monotonic dts" in text:
        return "The playback encoder encountered conflicting video timestamps. Check the worker diagnostics and preparation recipe."
    return f"FFmpeg conversion failed (exit code {code}). Check the worker's FFmpeg diagnostics for the cause."


def convert_playback(source: Path, output: Path, settings: Settings, recipe: dict) -> dict:
    version = recipe.get("recipe")
    if version not in {"h264-playback/1.0", "h264-playback/1.1"}:
        raise InvalidMedia("This preparation recipe is unsupported by the worker.")
    # Preserve the recorded behavior of old pending jobs. Explicit retries create
    # a new request with recipe 1.1; never silently rewrite a job's settings.
    timing_options = ["-fps_mode:v", "passthrough"]
    if version == "h264-playback/1.1":
        timing_options = [
            "-fps_mode:v",
            recipe["fps_mode"],
            "-enc_time_base:v",
            recipe["encoder_time_base"],
            "-video_track_timescale",
            str(recipe["video_track_timescale"]),
            "-bf:v",
            str(recipe["max_b_frames"]),
        ]
    original = probe_video(source, settings)
    try:
        code, stderr = _run_conversion(
            [
                settings.ffmpeg_binary,
                "-nostdin",
                "-hide_banner",
                "-nostats",
                "-v",
                "error",
                "-xerror",
                "-protocol_whitelist",
                "file",
                "-format_whitelist",
                MEDIA_DEMUXERS,
                "-threads",
                str(recipe["threads"]),
                "-copyts",
                "-start_at_zero",
                "-i",
                str(source),
                "-map",
                "0:v:0",
                "-map",
                "0:a:0?",
                "-map_metadata",
                "-1",
                "-map_chapters",
                "-1",
                "-c:v",
                "libx264",
                "-preset",
                recipe["preset"],
                "-crf",
                str(recipe["crf"]),
                "-pix_fmt",
                "yuv420p",
                "-filter_threads",
                str(recipe["threads"]),
                "-vf",
                "pad=ceil(iw/2)*2:ceil(ih/2)*2",
                *timing_options,
                "-threads",
                str(recipe["threads"]),
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-movflags",
                "+faststart",
                "-fs",
                str(recipe["max_bytes"]),
                "-y",
                str(output),
            ],
            timeout=recipe["timeout_seconds"],
        )
    except FileNotFoundError as error:
        raise MediaToolUnavailable("FFmpeg is unavailable. Rebuild the worker image.") from error
    except subprocess.TimeoutExpired as error:
        raise InvalidMedia("Playback conversion exceeded its configured time limit.") from error
    if code or not output.exists() or output.stat().st_size == 0:
        diagnostic = _conversion_diagnostic(stderr, source, output)
        logging.error("FFmpeg conversion exit=%s; stderr tail (redacted):\n%s", code, diagnostic)
        raise InvalidMedia(
            _conversion_failure_message(code, diagnostic)
            if code
            else "FFmpeg completed without producing a usable playback file. Check worker diagnostics."
        )
    if output.stat().st_size >= recipe["max_bytes"]:
        raise InvalidMedia("The playback copy exceeded its configured size limit.")
    converted = probe_video(output, settings)
    tolerance = max(0.1, min(0.25, 2 / (original.frame_rate or 25)))
    if (
        converted.codec != "h264"
        or abs(converted.duration - original.duration) > tolerance
        or abs(converted.relative_video_start - original.relative_video_start) > tolerance
        or converted.width != original.width + original.width % 2
        or converted.height != original.height + original.height % 2
    ):
        raise InvalidMedia(
            "The playback copy failed timeline or image-size validation. The original is unchanged."
        )
    return {
        "recipe": version,
        "fps_mode": recipe.get("fps_mode", "passthrough"),
        "source_duration": original.duration,
        "playback_duration": converted.duration,
        "source_video_start": original.relative_video_start,
        "playback_video_start": converted.relative_video_start,
        "tolerance_seconds": tolerance,
    }


def prepare_playback(job_identity: str) -> None:
    """RQ receives an identifier only; resolve all trusted inputs from PostgreSQL."""
    job_id = UUID(job_identity)
    settings = Settings()
    engine = create_database_engine(settings)
    try:
        # The connection/session-level lock survives commits, but dies with this process.
        # Recovery uses the same lock, so an active conversion cannot be reclaimed.
        with engine.connect() as connection:
            if not connection.scalar(
                text("SELECT pg_try_advisory_lock(:key)"), {"key": MEDIA_EXECUTION_LOCK}
            ):
                return  # Durable queued row will be republished; another conversion is active.
            connection.commit()
            factory = create_session_factory(connection)
            try:
                _prepare(factory, job_id, settings)
            finally:
                connection.execute(
                    text("SELECT pg_advisory_unlock(:key)"), {"key": MEDIA_EXECUTION_LOCK}
                )
                connection.commit()
    finally:
        engine.dispose()


def _prepare(factory, job_id: UUID, settings: Settings) -> None:
    # Lock order everywhere is video, then job. Deletion can proceed during CPU work,
    # and final publication rechecks the video while holding the same deletion lock.
    with factory() as session:
        identity = session.get(MediaJob, job_id)
        if identity is None:
            return
        video_id = identity.video_id
        video = session.get(Video, video_id, with_for_update=True)
        job = session.get(MediaJob, job_id, with_for_update=True, populate_existing=True)
        if not job or job.status != "queued":
            return
        if not video or video.upload_state != "ready":
            job.status, job.stage = "failed", "failed"
            job.last_error = "The original is unavailable or is being deleted."
            job.finished_at = datetime.now(UTC)
            session.commit()
            raise PlaybackPreparationFailed(job.last_error)
        if video.sha256 != job.source_sha256 or not video.object_key:
            job.status, job.stage = "failed", "failed"
            job.last_error = "The source no longer matches this preparation request."
            job.finished_at = datetime.now(UTC)
            session.commit()
            raise PlaybackPreparationFailed(job.last_error)
        job.status, job.stage = "running", "downloading"
        job.attempts += 1
        attempt = job.attempts
        job.started_at, job.finished_at, job.last_error = datetime.now(UTC), None, None
        source_key, bucket, checksum = video.object_key, video.source_bucket, video.sha256
        max_source_bytes = video.byte_size
        recipe = dict(job.settings)
        session.commit()
    phase = "initializing"
    try:
        root = settings.data_dir / "playback"
        root.mkdir(parents=True, exist_ok=True)
        store = S3Storage(settings)
        with TemporaryDirectory(prefix=f"{job_id}-", dir=root) as scratch:
            source, output = Path(scratch) / "original", Path(scratch) / "playback.mp4"
            phase = "downloading"
            store.download(bucket, source_key, source, max_source_bytes)
            phase = "checking_source"
            digest = hashlib.sha256()
            with source.open("rb") as stream:
                for block in iter(lambda: stream.read(1024**2), b""):
                    digest.update(block)
            if source.stat().st_size != max_source_bytes or digest.hexdigest() != checksum:
                raise InvalidMedia("The original failed its stored size/checksum validation.")
            if not _stage(factory, video_id, job_id, attempt, "converting"):
                return
            phase = "converting"
            validation = convert_playback(source, output, settings, recipe)
            phase = "storing"
            with factory() as session:
                video = session.get(Video, video_id, with_for_update=True)
                job = session.get(MediaJob, job_id, with_for_update=True)
                if (
                    not video
                    or video.upload_state != "ready"
                    or not job
                    or job.status != "running"
                    or job.attempts != attempt
                ):
                    return
                if video.sha256 != checksum:
                    raise InvalidMedia("The source changed during preparation.")
                # Do not expose a partial file. Publication is protected against deletion.
                job.stage = "storing"
                session.commit()
            with factory() as session:
                video = session.get(Video, video_id, with_for_update=True)
                job = session.get(MediaJob, job_id, with_for_update=True)
                if (
                    not video
                    or video.upload_state != "ready"
                    or not job
                    or job.status != "running"
                    or job.attempts != attempt
                ):
                    return
                existing = session.scalar(
                    select(Artifact).where(
                        Artifact.video_id == video_id, Artifact.kind == "playback"
                    )
                )
                if not existing:
                    key = f"videos/{video_id}/playback/{job_id}/playback.mp4"
                    store.upload(output, bucket, key, "video/mp4")
                    session.add(
                        Artifact(
                            video_id=video_id,
                            kind="playback",
                            bucket=bucket,
                            object_key=key,
                            content_type="video/mp4",
                            byte_size=output.stat().st_size,
                        )
                    )
                job.status, job.stage, job.finished_at = "succeeded", "completed", datetime.now(UTC)
                job.settings = {**recipe, "validation": validation}
                session.add(
                    AuditEvent(
                        actor_id=job.requested_by,
                        action="video.playback_prepared",
                        resource_type="video",
                        resource_id=str(video_id),
                        details={"job_id": str(job_id)},
                    )
                )
                session.commit()
    except Exception as error:
        message = (
            str(error)
            if isinstance(error, (InvalidMedia, MediaToolUnavailable, StorageUnavailable))
            else "Playback preparation failed. Check worker storage and configuration, then retry."
        )
        # Report code locations, never raw exception strings, locals, source text,
        # URLs or SDK diagnostics that could include credentials.
        locations = " -> ".join(
            f"{Path(frame.filename).name}:{frame.lineno} in {frame.name}"
            for frame in traceback.extract_tb(error.__traceback__)[-8:]
        )
        logging.error(
            "Playback preparation %s failed during %s (%s); locations: %s",
            job_id,
            phase,
            type(error).__name__,
            locations,
        )
        with factory() as session:
            job = session.get(MediaJob, job_id, with_for_update=True)
            if job and job.status == "running" and job.attempts == attempt:
                job.status, job.stage, job.last_error = "failed", "failed", message[:300]
                job.finished_at = datetime.now(UTC)
                session.add(
                    AuditEvent(
                        actor_id=job.requested_by,
                        action="video.playback_preparation_failed",
                        resource_type="video",
                        resource_id=str(job.video_id),
                        details={"job_id": str(job_id)},
                    )
                )
                session.commit()
        # Returning normally would tell RQ that conversion succeeded. Suppress
        # the original exception chain so its safe replacement is all RQ records.
        raise PlaybackPreparationFailed(f"{message} Stage: {phase}.") from None


def _stage(factory, video_id: UUID, job_id: UUID, attempt: int, stage: str) -> bool:
    with factory() as session:
        video = session.get(Video, video_id, with_for_update=True)
        job = session.get(MediaJob, job_id, with_for_update=True)
        if (
            not video
            or video.upload_state != "ready"
            or not job
            or job.status != "running"
            or job.attempts != attempt
        ):
            return False
        job.stage = stage
        session.commit()
        return True
