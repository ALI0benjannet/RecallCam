import asyncio

import httpx
import pytest
from pydantic import ValidationError

from recallcam_backend.main import create_app
from recallcam_shared.settings import Settings


def test_model_endpoint_and_id_are_environment_configuration(monkeypatch):
    monkeypatch.setenv("VLM_BASE_URL", "http://model-server.example:1235")
    monkeypatch.setenv("VLM_MODEL_ID", "deployment-specific-qwen")
    monkeypatch.setenv("VLM_API_KEY", "test-only-secret")
    settings = Settings(_env_file=None)
    assert str(settings.vlm_base_url) == "http://model-server.example:1235/"
    assert settings.vlm_model_id == "deployment-specific-qwen"
    assert "test-only-secret" not in repr(settings)


def test_sequential_profile_rejects_accidental_parallel_jobs():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, indexing_concurrency=2)


def test_api_is_live_without_claiming_query_implementation():
    async def check():
        transport = httpx.ASGITransport(app=create_app(Settings(_env_file=None)))
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            assert (await client.get("/health/live")).json()["status"] == "ok"
            result = await client.post("/api/queries", json={"question": "When did someone enter?"})
            assert result.status_code == 501

    asyncio.run(check())
