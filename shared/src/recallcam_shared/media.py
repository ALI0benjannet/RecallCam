"""Shared bounded media inspection and thumbnail tools; no model inference."""

import json
import math
import subprocess
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path

from recallcam_shared.settings import Settings

# Share the same input policy between metadata probing and thumbnail decoding.
# `mpeg` is the MPEG program-stream demuxer used by the CAVIAR .mpg samples.
MEDIA_DEMUXERS = "mov,matroska,webm,avi,mpeg"


class InvalidMedia(Exception):
    pass


class MediaToolUnavailable(Exception):
    pass


@dataclass(frozen=True)
class MediaInfo:
    duration: float
    width: int
    height: int
    frame_rate: float | None
    codec: str
    relative_video_start: float = 0.0


def probe_video(path: Path, settings: Settings) -> MediaInfo:
    try:
        result = subprocess.run(
            [
                settings.ffprobe_binary,
                "-v",
                "error",
                "-protocol_whitelist",
                "file",
                "-format_whitelist",
                MEDIA_DEMUXERS,
                "-probesize",
                "8000000",
                "-analyzeduration",
                "5000000",
                "-show_entries",
                "format=duration,start_time:stream=codec_type,codec_name,width,height,avg_frame_rate,duration,start_time:stream_disposition=attached_pic",
                "-of",
                "json",
                str(path),
            ],
            capture_output=True,
            timeout=settings.media_probe_timeout_seconds,
            check=False,
        )
    except FileNotFoundError as error:
        raise MediaToolUnavailable(
            "FFprobe is unavailable. Rebuild the Python application image."
        ) from error
    except subprocess.TimeoutExpired as error:
        raise InvalidMedia(
            "The video could not be inspected within the configured time limit."
        ) from error
    try:
        if result.returncode or len(result.stdout) > 1024**2:
            raise ValueError("Invalid probe output")
        data = json.loads(result.stdout)
        stream = next(
            item
            for item in data.get("streams", [])
            if item.get("codec_type") == "video"
            and not item.get("disposition", {}).get("attached_pic")
        )
        duration = float(data.get("format", {}).get("duration") or stream.get("duration") or 0)
        width, height = int(stream.get("width", 0)), int(stream.get("height", 0))
        relative_start = float(stream.get("start_time") or 0) - float(
            data.get("format", {}).get("start_time") or 0
        )
        if not math.isfinite(duration) or duration <= 0 or width <= 0 or height <= 0:
            raise ValueError("Missing usable video dimensions or duration")
        try:
            frame_rate = float(Fraction(stream.get("avg_frame_rate", "0/1")))
        except (ValueError, ZeroDivisionError):
            frame_rate = 0
        return MediaInfo(
            duration,
            width,
            height,
            frame_rate if math.isfinite(frame_rate) and frame_rate > 0 else None,
            str(stream.get("codec_name", "unknown"))[:80],
            relative_start if math.isfinite(relative_start) else 0.0,
        )
    except (ValueError, KeyError, TypeError, StopIteration) as error:
        raise InvalidMedia(
            "The file is not a supported, readable video with a known duration."
        ) from error


def create_thumbnail(source: Path, destination: Path, settings: Settings) -> bool:
    try:
        result = subprocess.run(
            [
                settings.ffmpeg_binary,
                "-nostdin",
                "-v",
                "error",
                "-protocol_whitelist",
                "file",
                "-format_whitelist",
                MEDIA_DEMUXERS,
                "-threads",
                "1",
                "-i",
                str(source),
                "-map",
                "0:v:0",
                "-frames:v",
                "1",
                "-vf",
                "scale=480:270:force_original_aspect_ratio=decrease",
                "-map_metadata",
                "-1",
                "-threads",
                "1",
                "-y",
                str(destination),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=settings.media_preview_timeout_seconds,
            check=False,
        )
        return result.returncode == 0 and destination.exists() and destination.stat().st_size > 0
    except (OSError, subprocess.TimeoutExpired):
        return False
