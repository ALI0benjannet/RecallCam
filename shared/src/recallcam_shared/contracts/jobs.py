"""Initial execution contracts, not replacements for the indexed-chunk schema."""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class StageName(StrEnum):
    PREPARE = "prepare"
    PERCEPTION = "perception"
    VISUAL_EMBEDDINGS = "visual_embeddings"
    CAPTIONS = "captions"
    SUMMARIES = "summaries"
    TEXT_EMBEDDINGS = "text_embeddings"
    FINALIZE = "finalize"


class JobContext(BaseModel):
    """References to persisted inputs; never embed video/image bytes here."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    job_id: str = Field(min_length=1)
    video_id: str = Field(min_length=1)
    source_key: str = Field(min_length=1)
    config_revision: str = Field(min_length=1)
