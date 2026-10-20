from fastapi import APIRouter, Query
from sqlalchemy import String, and_, cast, func, or_, select
from sqlalchemy.orm import aliased

from recallcam_backend.dependencies import DatabaseSession
from recallcam_backend.security import require_permission
from recallcam_shared.contracts.access import Permission
from recallcam_shared.contracts.accounts import AuditEventPage, AuditEventRead
from recallcam_shared.database.models import AuditEvent, Camera, User, Video

router = APIRouter(prefix="/audit-events", tags=["audit"])


@router.get("", response_model=AuditEventPage)
@require_permission(Permission.AUDIT_READ)
def list_audit_events(
    session: DatabaseSession,
    search: str = Query(default="", max_length=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> AuditEventPage:
    actor, subject = aliased(User), aliased(User)
    resource_name = func.coalesce(subject.display_name, Camera.name, Video.title)
    base = (
        select(AuditEvent, actor.display_name, resource_name)
        .outerjoin(actor, AuditEvent.actor_id == actor.user_id)
        .outerjoin(
            subject,
            and_(
                AuditEvent.resource_type == "user",
                AuditEvent.resource_id == cast(subject.user_id, String),
            ),
        )
        .outerjoin(
            Camera,
            and_(
                AuditEvent.resource_type == "camera",
                AuditEvent.resource_id == cast(Camera.camera_id, String),
            ),
        )
        .outerjoin(
            Video,
            and_(
                AuditEvent.resource_type == "video",
                AuditEvent.resource_id == cast(Video.video_id, String),
            ),
        )
    )
    if search.strip():
        pattern = f"%{search.strip()}%"
        base = base.where(
            or_(
                AuditEvent.action.ilike(pattern),
                AuditEvent.resource_type.ilike(pattern),
                actor.display_name.ilike(pattern),
                resource_name.ilike(pattern),
            )
        )
    total = session.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = session.execute(
        base.order_by(AuditEvent.occurred_at.desc(), AuditEvent.event_id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = []
    for event, actor_name, name in rows:
        fields = {
            key: getattr(event, key)
            for key in AuditEventRead.model_fields
            if key not in {"actor_name", "resource_name"}
        }
        items.append(
            AuditEventRead(
                **fields,
                actor_name=actor_name or ("Former account" if event.actor_id else "System"),
                resource_name=name
                or {
                    "camera": "Removed camera",
                    "user": "Former account",
                    "video": "Removed recording",
                }.get(event.resource_type, event.resource_type.replace("_", " ").title()),
            )
        )
    return AuditEventPage(items=items, total=total, page=page, page_size=page_size)
