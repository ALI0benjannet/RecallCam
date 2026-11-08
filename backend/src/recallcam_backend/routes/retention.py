"""Request/response only; the worker owns enforcement and all scheduling."""

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from recallcam_backend.dependencies import CurrentUser, DatabaseSession
from recallcam_backend.security import require_permission
from recallcam_backend.services.audit import record_audit
from recallcam_shared.contracts.access import Permission
from recallcam_shared.contracts.retention import (
    RetentionCandidate,
    RetentionPreview,
    RetentionRead,
    RetentionUpdate,
)
from recallcam_shared.database.models import Camera, RetentionPolicy, Video
from recallcam_shared.retention import RETENTION_POLICY_ID, expiry_conditions, expiry_cutoff

router = APIRouter(prefix="/retention", tags=["retention"])


def _policy(session: Session, *, lock: bool = False) -> RetentionPolicy:
    policy = session.get(RetentionPolicy, RETENTION_POLICY_ID, with_for_update=lock)
    if policy is None:
        raise HTTPException(status_code=503, detail="Recording retention has not been initialized.")
    return policy


@router.get("", response_model=RetentionRead)
@require_permission(Permission.RETENTION_MANAGE)
def read_policy(session: DatabaseSession, response: Response) -> RetentionRead:
    response.headers["Cache-Control"] = "no-store"
    return RetentionRead.model_validate(_policy(session))


@router.get("/preview", response_model=RetentionPreview)
@require_permission(Permission.RETENTION_MANAGE)
def preview_policy(
    session: DatabaseSession,
    response: Response,
    retention_days: int = Query(ge=1, le=3650),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> RetentionPreview:
    response.headers["Cache-Control"] = "no-store"
    cutoff = expiry_cutoff(retention_days)
    conditions = expiry_conditions(cutoff)
    total = session.scalar(select(func.count()).select_from(Video).where(*conditions)) or 0
    rows = session.execute(
        select(Video.video_id, Video.title, Camera.name.label("camera_name"), Video.recording_end)
        .join(Camera, Camera.camera_id == Video.camera_id)
        .where(*conditions)
        .order_by(Video.recording_end, Video.video_id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return RetentionPreview(
        retention_days=retention_days,
        cutoff=cutoff,
        total=total,
        page=page,
        page_size=page_size,
        items=[RetentionCandidate.model_validate(row._mapping) for row in rows],
    )


@router.put("", response_model=RetentionRead)
@require_permission(Permission.RETENTION_MANAGE)
def update_policy(
    body: RetentionUpdate, current: CurrentUser, session: DatabaseSession, response: Response
) -> RetentionRead:
    response.headers["Cache-Control"] = "no-store"
    policy = _policy(session, lock=True)
    if policy.revision != body.expected_revision:
        raise HTTPException(
            status_code=409, detail="The retention policy changed. Reload it before saving."
        )
    if (
        body.enabled
        and (not policy.enabled or body.retention_days < policy.retention_days)
        and not body.confirm_deletion
    ):
        raise HTTPException(
            status_code=409,
            detail="Confirm automatic deletion before enabling retention or shortening an active period.",
        )
    if (policy.enabled, policy.retention_days) == (body.enabled, body.retention_days):
        return RetentionRead.model_validate(policy)
    previous = {"enabled": policy.enabled, "retention_days": policy.retention_days}
    policy.enabled, policy.retention_days = body.enabled, body.retention_days
    policy.revision += 1
    record_audit(
        session,
        actor_id=current.user_id,
        action="retention.policy_updated",
        resource_type="retention_policy",
        details={
            "previous": previous,
            "enabled": policy.enabled,
            "retention_days": policy.retention_days,
            "revision": policy.revision,
        },
    )
    session.flush()
    session.refresh(policy)
    result = RetentionRead.model_validate(policy)
    session.commit()
    return result
