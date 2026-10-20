from uuid import UUID

from sqlalchemy.orm import Session

from recallcam_shared.database.models import AuditEvent


def record_audit(
    session: Session,
    *,
    actor_id: UUID | None,
    action: str,
    resource_type: str,
    resource_id: UUID | str | None = None,
    details: dict | None = None,
) -> None:
    """Store bounded action metadata; callers must never pass credentials or footage."""
    session.add(
        AuditEvent(
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            details=details or {},
        )
    )
