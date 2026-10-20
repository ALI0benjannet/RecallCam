from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select

from recallcam_backend.dependencies import DatabaseSession
from recallcam_backend.security import require_permission
from recallcam_shared.contracts.access import Permission
from recallcam_shared.contracts.accounts import AuditEventPage, AuditEventRead
from recallcam_shared.database.models import AuditEvent

router = APIRouter(prefix="/audit-events", tags=["audit"])


@router.get("", response_model=AuditEventPage)
@require_permission(Permission.AUDIT_READ)
def list_audit_events(
    session: DatabaseSession,
    search: str = Query(default="", max_length=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> AuditEventPage:
    filters = []
    if search.strip():
        pattern = f"%{search.strip()}%"
        filters.append(
            or_(AuditEvent.action.ilike(pattern), AuditEvent.resource_type.ilike(pattern))
        )
    total = session.scalar(select(func.count()).select_from(AuditEvent).where(*filters)) or 0
    events = session.scalars(
        select(AuditEvent)
        .where(*filters)
        .order_by(AuditEvent.occurred_at.desc(), AuditEvent.event_id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return AuditEventPage(
        items=[AuditEventRead.model_validate(event) for event in events],
        total=total,
        page=page,
        page_size=page_size,
    )
