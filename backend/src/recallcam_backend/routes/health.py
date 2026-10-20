from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health/live")
def liveness() -> dict[str, str]:
    """Process liveness only; this does not claim infrastructure readiness."""
    return {"status": "ok", "service": "recallcam-backend"}
