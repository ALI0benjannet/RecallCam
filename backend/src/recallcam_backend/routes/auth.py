from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import select

from recallcam_backend.dependencies import CurrentUser, DatabaseSession
from recallcam_backend.security import (
    authenticated_endpoint,
    hash_password,
    password_needs_rehash,
    public_endpoint,
    verify_password,
)
from recallcam_backend.services.audit import record_audit
from recallcam_shared.contracts.accounts import (
    LoginRequest,
    LoginResponse,
    PasswordChange,
    UserRead,
)
from recallcam_shared.database.models import User

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/login", response_model=LoginResponse)
@public_endpoint
def login(body: LoginRequest, request: Request, session: DatabaseSession) -> LoginResponse:
    user = session.scalar(select(User).where(User.email == str(body.email).lower()))
    password_hash = user.password_hash if user else request.app.state.dummy_password_hash
    valid_password = verify_password(body.password.get_secret_value(), password_hash)
    if not valid_password or user is None or not user.is_active:
        # Unknown and disabled users share the same response and password-hash work.
        raise HTTPException(
            status_code=401,
            detail="The email or password is incorrect.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password.get_secret_value())
    token, lifetime = request.app.state.tokens.create(user)
    record_audit(
        session,
        actor_id=user.user_id,
        action="auth.login",
        resource_type="user",
        resource_id=user.user_id,
    )
    session.commit()
    return LoginResponse(
        access_token=token, expires_in=lifetime, user=UserRead.model_validate(user)
    )


@router.get("/me", response_model=UserRead)
@authenticated_endpoint
def current_user(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user)


@router.post("/change-password", status_code=204)
@authenticated_endpoint
def change_password(
    body: PasswordChange, current: CurrentUser, session: DatabaseSession
) -> Response:
    user = session.get(User, current.user_id, with_for_update=True)
    if user is None or not verify_password(
        body.current_password.get_secret_value(), user.password_hash
    ):
        raise HTTPException(status_code=400, detail="The current password is incorrect.")
    if body.current_password.get_secret_value() == body.new_password.get_secret_value():
        raise HTTPException(status_code=400, detail="Choose a different new password.")
    user.password_hash = hash_password(body.new_password.get_secret_value())
    user.auth_version += 1
    record_audit(
        session,
        actor_id=current.user_id,
        action="auth.password_changed",
        resource_type="user",
        resource_id=current.user_id,
    )
    session.commit()
    return Response(status_code=204)
