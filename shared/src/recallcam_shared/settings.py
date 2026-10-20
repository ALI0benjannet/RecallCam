"""Configuration loaded by host processes started from the repository root."""

from pathlib import Path
from typing import Literal

from pydantic import AnyHttpUrl, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: SecretStr = SecretStr("postgresql://localhost/recallcam")
    redis_url: SecretStr = SecretStr("redis://127.0.0.1:6379/0")
    qdrant_url: AnyHttpUrl = AnyHttpUrl("http://127.0.0.1:6333")
    qdrant_api_key: SecretStr = SecretStr("")
    storage_backend: Literal["s3", "filesystem"] = "s3"
    s3_endpoint_url: AnyHttpUrl = AnyHttpUrl("http://127.0.0.1:9000")
    s3_access_key_id: SecretStr = SecretStr("")
    s3_secret_access_key: SecretStr = SecretStr("")
    s3_bucket: str = Field(default="recallcam", min_length=3)
    s3_region: str = "us-east-1"
    data_dir: Path = Path("data")
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    vlm_api_style: Literal["lmstudio-native", "openai-compatible"] = "lmstudio-native"
    vlm_base_url: AnyHttpUrl = AnyHttpUrl("http://127.0.0.1:1234")
    vlm_model_id: str = "qwen3-vl-4b-instruct-mlx"
    vlm_api_key: SecretStr = SecretStr("")
    vlm_timeout_seconds: float = Field(default=180, gt=0)
    llm_api_style: Literal["lmstudio-native", "openai-compatible"] = "openai-compatible"
    llm_base_url: AnyHttpUrl = AnyHttpUrl("http://127.0.0.1:1234/v1")
    llm_model_id: str = ""
    llm_api_key: SecretStr = SecretStr("")
    llm_timeout_seconds: float = Field(default=120, gt=0)
    cv_device: Literal["auto", "cpu", "cuda", "mps"] = "auto"
    embedding_device: Literal["auto", "cpu", "cuda", "mps"] = "auto"
    indexing_concurrency: Literal[1] = 1
