import json

from fastapi import APIRouter, Request, Response
from redis import Redis
from redis.exceptions import RedisError

from recallcam_backend.security import authenticated_endpoint
from recallcam_shared.monitoring import WORKER_HEARTBEAT_KEY

router = APIRouter(prefix="/services", tags=["health"])


@router.get("/status")
@authenticated_endpoint
def service_status(request: Request, response: Response) -> dict:
    worker = {"connected": False, "mode": "unknown", "message": "No recent worker heartbeat."}
    try:
        with Redis.from_url(
            request.app.state.settings.redis_url.get_secret_value(),
            socket_connect_timeout=1,
            socket_timeout=1,
            decode_responses=True,
        ) as client:
            payload = client.get(WORKER_HEARTBEAT_KEY)
        if payload:
            heartbeat = json.loads(payload)
            if heartbeat.get("mode") == "standby":
                worker = {
                    "connected": True,
                    "mode": "standby",
                    "message": "Worker connected in standby. No videos are processed.",
                }
            elif heartbeat.get("mode") == "media":
                worker = {
                    "connected": True,
                    "mode": "media",
                    "message": "Worker connected for explicitly queued playback preparation. AI indexing is unavailable.",
                }
    except (RedisError, ValueError, AttributeError):
        worker["message"] = "Worker presence cannot be checked: heartbeat storage is unavailable."
    response.headers["Cache-Control"] = "no-store"
    return {
        "backend": {
            "connected": True,
            "message": "Backend API and authentication database reachable.",
        },
        "worker": worker,
    }
