from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from recallcam_backend.dependencies import CurrentUser, DatabaseSession
from recallcam_backend.security import hash_password, require_permission
from recallcam_backend.services.audit import record_audit
from recallcam_shared.contracts.access import Permission, Role
from recallcam_shared.contracts.accounts import (
    PasswordReset,
    UserCreate,
    UserPage,
    UserRead,
    UserUpdate,
)
from recallcam_shared.database.models import User

router = APIRouter(prefix="/users", tags=["users"])
USER_ADMIN_LOCK = 724193601


def lock_user_administration(session: Session) -> None:
    """Serialize account administration across processes, including CLI bootstrap."""
    session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": USER_ADMIN_LOCK})


@router.get("", response_model=UserPage)
@require_permission(Permission.USERS_MANAGE)
def list_users(
    session: DatabaseSession,
    search: str = Query(default="", max_length=200),
    role: Role | None = None,
    is_active: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> UserPage:
    filters = []
    if search.strip():
        pattern = f"%{search.strip()}%"
        filters.append(or_(User.email.ilike(pattern), User.display_name.ilike(pattern)))
    if role is not None:
        filters.append(User.role == role.value)
    if is_active is not None:
        filters.append(User.is_active == is_active)
    total = session.scalar(select(func.count()).select_from(User).where(*filters)) or 0
    users = session.scalars(
        select(User)
        .where(*filters)
        .order_by(User.created_at.desc(), User.user_id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return UserPage(
        items=[UserRead.model_validate(user) for user in users],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=UserRead, status_code=201)
@require_permission(Permission.USERS_MANAGE)
def create_user(body: UserCreate, current: CurrentUser, session: DatabaseSession) -> UserRead:
    lock_user_administration(session)
    email = str(body.email).lower()
    if session.scalar(select(User.user_id).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account already uses this email address.")
    user = User(
        email=email,
        display_name=body.display_name,
        password_hash=hash_password(body.password.get_secret_value()),
        role=body.role.value,
        created_by=current.user_id,
    )
    session.add(user)
    try:
        session.flush()
        record_audit(
            session,
            actor_id=current.user_id,
            action="user.created",
            resource_type="user",
            resource_id=user.user_id,
            details={"role": user.role},
        )
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(
            status_code=409, detail="An account already uses this email address."
        ) from error
    return UserRead.model_validate(user)


@router.get("/{user_id}", response_model=UserRead)
@require_permission(Permission.USERS_MANAGE)
def get_user(user_id: UUID, session: DatabaseSession) -> UserRead:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return UserRead.model_validate(user)


@router.patch("/{user_id}", response_model=UserRead)
@require_permission(Permission.USERS_MANAGE)
def update_user(
    user_id: UUID, body: UserUpdate, current: CurrentUser, session: DatabaseSession
) -> UserRead:
    lock_user_administration(session)
    user = session.get(User, user_id, with_for_update=True)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    changes = body.model_dump(exclude_unset=True)
    if not changes or any(value is None for value in changes.values()):
        raise HTTPException(status_code=400, detail="Provide at least one non-null account change.")
    new_role = changes.get("role", Role(user.role))
    new_active = changes.get("is_active", user.is_active)
    removing_admin = (
        user.role == Role.ADMINISTRATOR
        and user.is_active
        and (new_role != Role.ADMINISTRATOR or not new_active)
    )
    if user_id == current.user_id and (new_role != Role.ADMINISTRATOR or not new_active):
        raise HTTPException(
            status_code=400, detail="You cannot deactivate your own account or remove your admin role."
        )
    if removing_admin:
        administrators = session.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role == Role.ADMINISTRATOR, User.is_active.is_(True))
        )
        if administrators is None or administrators <= 1:
            raise HTTPException(status_code=409, detail="Keep at least one active administrator.")
    previous_role = user.role
    previous_active = user.is_active
    for field, value in changes.items():
        setattr(user, field, value.value if isinstance(value, Role) else value)
    if previous_active and not user.is_active:
        user.auth_version += 1
    record_audit(
        session,
        actor_id=current.user_id,
        action="user.updated",
        resource_type="user",
        resource_id=user.user_id,
        details={
            "changed_fields": sorted(changes),
            "previous_role": previous_role,
            "role": user.role,
            "is_active": user.is_active,
        },
    )
    session.commit()
    return UserRead.model_validate(user)


@router.post("/{user_id}/password", status_code=204)
@require_permission(Permission.USERS_MANAGE)
def reset_password(
    user_id: UUID, body: PasswordReset, current: CurrentUser, session: DatabaseSession
) -> Response:
    if user_id == current.user_id:
        raise HTTPException(
            status_code=400, detail="Use Change password to update your own password."
        )
    lock_user_administration(session)
    user = session.get(User, user_id, with_for_update=True)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    user.password_hash = hash_password(body.password.get_secret_value())
    user.auth_version += 1
    record_audit(
        session,
        actor_id=current.user_id,
        action="user.password_reset",
        resource_type="user",
        resource_id=user_id,
    )
    session.commit()
    return Response(status_code=204)
