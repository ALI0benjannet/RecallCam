"""JWT signing, password hashing and route authorization metadata."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TypeVar
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import HTTPException

from recallcam_shared.contracts.access import Permission, Role
from recallcam_shared.database.models import User
from recallcam_shared.settings import Settings

Endpoint = TypeVar("Endpoint", bound=Callable)
_PASSWORD_HASHER = PasswordHasher()


def require_permission(permission: Permission) -> Callable[[Endpoint], Endpoint]:
    """Attach policy to the endpoint without wrapping its FastAPI signature."""

    def decorate(endpoint: Endpoint) -> Endpoint:
        endpoint.__recallcam_permission__ = permission
        return endpoint

    return decorate


def public_endpoint(endpoint: Endpoint) -> Endpoint:
    endpoint.__recallcam_public__ = True
    return endpoint


def authenticated_endpoint(endpoint: Endpoint) -> Endpoint:
    endpoint.__recallcam_authenticated__ = True
    return endpoint


@dataclass(frozen=True)
class Principal:
    user_id: UUID
    email: str
    display_name: str
    role: Role
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_user(cls, user: User) -> "Principal":
        return cls(
            user_id=user.user_id,
            email=user.email,
            display_name=user.display_name,
            role=Role(user.role),
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )


class TokenService:
    algorithm = "HS256"

    def __init__(self, settings: Settings):
        self.settings = settings

    def _signing_key(self) -> str:
        key = self.settings.jwt_signing_key.get_secret_value()
        if len(key.encode("utf-8")) < 32:
            raise HTTPException(
                status_code=503,
                detail="Authentication is not configured. Set JWT_SIGNING_KEY to at least 32 bytes.",
            )
        return key

    def create(self, user: User) -> tuple[str, int]:
        now = datetime.now(UTC)
        lifetime = self.settings.jwt_access_token_minutes * 60
        token = jwt.encode(
            {
                "sub": str(user.user_id),
                "ver": user.auth_version,
                "iss": self.settings.jwt_issuer,
                "aud": self.settings.jwt_audience,
                "iat": now,
                "nbf": now,
                "exp": now + timedelta(seconds=lifetime),
            },
            self._signing_key(),
            algorithm=self.algorithm,
        )
        return token, lifetime

    def validate(self, token: str) -> tuple[UUID, int]:
        key = self._signing_key()
        try:
            claims = jwt.decode(
                token,
                key,
                algorithms=[self.algorithm],
                issuer=self.settings.jwt_issuer,
                audience=self.settings.jwt_audience,
                options={"require": ["sub", "ver", "iss", "aud", "iat", "nbf", "exp"]},
            )
            user_id = UUID(claims["sub"])
            version = claims["ver"]
            if not isinstance(version, int) or isinstance(version, bool) or version < 0:
                raise ValueError("Invalid account version.")
            return user_id, version
        except (jwt.InvalidTokenError, ValueError, TypeError, KeyError) as error:
            raise unauthorized() from error


def unauthorized() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="Your sign-in is missing, invalid or expired. Please sign in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def hash_password(password: str) -> str:
    return _PASSWORD_HASHER.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _PASSWORD_HASHER.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    return _PASSWORD_HASHER.check_needs_rehash(password_hash)
