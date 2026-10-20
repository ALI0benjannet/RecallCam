"""Recording library and playback-preparation contracts; indexing remains separate."""

from datetime import datetime
from pathlib import PurePath
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, computed_field, field_validator

from recallcam_shared.contracts.accounts import CameraRead, InputModel

VIDEO_TYPES = {
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".mpg": "video/mpeg",
    ".mpeg": "video/mpeg",
}
UploadState = Literal["pending", "uploading", "ready", "failed", "deleting"]


class VideoCreate(InputModel):
    camera_id: UUID
    original_filename: str = Field(min_length=1, max_length=255)
    expected_byte_size: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    recording_start: AwareDatetime

    @field_validator("original_filename")
    @classmethod
    def valid_filename(cls, value: str) -> str:
        if (
            any(ord(char) < 32 or ord(char) == 127 for char in value)
            or "/" in value
            or "\\" in value
        ):
            raise ValueError("Use a file name without paths or control characters.")
        if PurePath(value).suffix.lower() not in VIDEO_TYPES:
            raise ValueError("Use MP4, M4V, MOV, WebM, MKV, AVI, MPG or MPEG footage.")
        return value

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Title must not be blank.")
        return value.strip()


class VideoUpdate(InputModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str | None) -> str | None:
        return VideoCreate.clean_title(value) if value is not None else None


class VideoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    schema_version: str
    producer_version: str
    video_id: UUID
    camera_id: UUID
    camera: CameraRead
    title: str
    description: str | None
    original_filename: str
    content_type: str
    expected_byte_size: int
    byte_size: int | None
    sha256: str | None
    upload_state: UploadState
    metadata_state: Literal["pending", "ready", "failed"]
    thumbnail_state: Literal["pending", "ready", "failed"]
    thumbnail_url: str | None = None
    recording_start: datetime
    recording_end: datetime | None
    recording_timezone: str
    duration_seconds: float | None
    width: int | None
    height: int | None
    frame_rate: float | None
    video_codec: str | None
    last_error: str | None
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def indexing_status(self) -> Literal["not_indexed"]:
        # Replace with the actual durable index revision once that feature exists.
        return "not_indexed"


class VideoPage(BaseModel):
    items: list[VideoRead]
    total: int
    page: int
    page_size: int


class PlaybackRead(BaseModel):
    url: str
    thumbnail_url: str | None
    expires_in: int
    content_type: str
    rendition: Literal["original", "playback"] = "original"


class PlaybackPreparationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    schema_version: str = "1.0"
    producer_version: str = "recallcam-app/0.1.0"
    job_id: UUID | None = None
    status: Literal["not_requested", "queued", "running", "succeeded", "failed"] = "not_requested"
    stage: str = "not_requested"
    attempts: int = 0
    last_error: str | None = None
    updated_at: datetime | None = None


class UploadPolicy(BaseModel):
    max_bytes: int
    extensions: list[str]
    timeout_seconds: int
