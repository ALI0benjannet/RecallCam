"""Versioned application contracts for retention policy and read-only preview."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from recallcam_shared.contracts.accounts import InputModel


class RetentionUpdate(InputModel):
    enabled: bool = Field(strict=True)
    retention_days: int = Field(strict=True, ge=1, le=3650)
    expected_revision: int = Field(strict=True, ge=1)
    confirm_deletion: bool = Field(default=False, strict=True)


class RetentionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    schema_version: str
    producer_version: str
    enabled: bool
    retention_days: int
    revision: int
    updated_at: datetime


class RetentionCandidate(BaseModel):
    video_id: UUID
    title: str
    camera_name: str
    recording_end: datetime


class RetentionPreview(BaseModel):
    schema_version: str = "1.0"
    producer_version: str = "recallcam-app/0.1.0"
    retention_days: int
    cutoff: datetime
    total: int
    page: int
    page_size: int
    items: list[RetentionCandidate]
