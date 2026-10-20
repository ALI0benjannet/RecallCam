from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, or_, select

from recallcam_backend.dependencies import CurrentUser, DatabaseSession
from recallcam_backend.security import require_permission
from recallcam_backend.services.audit import record_audit
from recallcam_shared.contracts.access import Permission
from recallcam_shared.contracts.accounts import CameraCreate, CameraPage, CameraRead, CameraUpdate
from recallcam_shared.database.models import Camera

router = APIRouter(prefix="/cameras", tags=["cameras"])


@router.get("", response_model=CameraPage)
@require_permission(Permission.FOOTAGE_READ)
def list_cameras(
    session: DatabaseSession,
    search: str = Query(default="", max_length=200),
    include_archived: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> CameraPage:
    filters = []
    if not include_archived:
        filters.append(Camera.is_active.is_(True))
    if search.strip():
        pattern = f"%{search.strip()}%"
        filters.append(or_(Camera.name.ilike(pattern), Camera.location.ilike(pattern)))
    total = session.scalar(select(func.count()).select_from(Camera).where(*filters)) or 0
    cameras = session.scalars(
        select(Camera)
        .where(*filters)
        .order_by(Camera.created_at.desc(), Camera.camera_id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return CameraPage(
        items=[CameraRead.model_validate(camera) for camera in cameras],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=CameraRead, status_code=201)
@require_permission(Permission.CAMERAS_MANAGE)
def create_camera(
    body: CameraCreate, current: CurrentUser, session: DatabaseSession
) -> CameraRead:
    camera = Camera(**body.model_dump(), created_by=current.user_id)
    session.add(camera)
    session.flush()
    record_audit(
        session,
        actor_id=current.user_id,
        action="camera.created",
        resource_type="camera",
        resource_id=camera.camera_id,
        details={"timezone": camera.timezone},
    )
    session.commit()
    return CameraRead.model_validate(camera)


@router.get("/{camera_id}", response_model=CameraRead)
@require_permission(Permission.FOOTAGE_READ)
def get_camera(camera_id: UUID, session: DatabaseSession) -> CameraRead:
    camera = session.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found.")
    return CameraRead.model_validate(camera)


@router.patch("/{camera_id}", response_model=CameraRead)
@require_permission(Permission.CAMERAS_MANAGE)
def update_camera(
    camera_id: UUID, body: CameraUpdate, current: CurrentUser, session: DatabaseSession
) -> CameraRead:
    camera = session.get(Camera, camera_id, with_for_update=True)
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found.")
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Provide at least one camera change.")
    if any(changes.get(field, "present") is None for field in ("name", "timezone", "is_active")):
        raise HTTPException(status_code=400, detail="Name, timezone and active status cannot be null.")
    for field, value in changes.items():
        setattr(camera, field, value)
    record_audit(
        session,
        actor_id=current.user_id,
        action="camera.updated",
        resource_type="camera",
        resource_id=camera_id,
        details={"changed_fields": sorted(changes), "is_active": camera.is_active},
    )
    session.commit()
    return CameraRead.model_validate(camera)
