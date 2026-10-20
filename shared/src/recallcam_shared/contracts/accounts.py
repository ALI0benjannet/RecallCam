"""Version-one application API contracts, separate from indexing records."""

from datetime import datetime
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    SecretStr,
    computed_field,
    field_validator,
)

from recallcam_shared.contracts.access import ROLE_PERMISSIONS, Role


class InputModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginRequest(InputModel):
    email: EmailStr
    password: SecretStr = Field(min_length=1, max_length=128)


class UserCreate(InputModel):
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=120)
    password: SecretStr = Field(min_length=12, max_length=128)
    role: Role = Role.OPERATOR

    @field_validator("display_name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Display name must not be blank.")
        return value.strip()


class UserUpdate(InputModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    role: Role | None = None
    is_active: bool | None = None

    @field_validator("display_name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("Display name must not be blank.")
        return value.strip() if value is not None else None


class PasswordReset(InputModel):
    password: SecretStr = Field(min_length=12, max_length=128)


class PasswordChange(InputModel):
    current_password: SecretStr = Field(min_length=1, max_length=128)
    new_password: SecretStr = Field(min_length=12, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    email: str
    display_name: str
    role: Role
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def permissions(self) -> list[str]:
        return sorted(permission.value for permission in ROLE_PERMISSIONS[self.role])


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead


class UserPage(BaseModel):
    items: list[UserRead]
    total: int
    page: int
    page_size: int


class CameraCreate(InputModel):
    name: str = Field(min_length=1, max_length=120)
    location: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    timezone: str = Field(min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Camera name must not be blank.")
        return value.strip()

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        value = value.strip()
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise ValueError("Use a valid IANA timezone, for example Africa/Tunis.") from error
        return value


class CameraUpdate(InputModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    location: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    timezone: str | None = Field(default=None, min_length=1, max_length=100)
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        return CameraCreate.clean_name(value) if value is not None else None

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str | None) -> str | None:
        return CameraCreate.valid_timezone(value) if value is not None else None


class CameraRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    camera_id: UUID
    name: str
    location: str | None
    description: str | None
    timezone: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CameraPage(BaseModel):
    items: list[CameraRead]
    total: int
    page: int
    page_size: int


class AuditEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_id: UUID
    actor_id: UUID | None
    actor_name: str
    resource_name: str
    action: str
    resource_type: str
    resource_id: str | None
    occurred_at: datetime
    details: dict


class AuditEventPage(BaseModel):
    items: list[AuditEventRead]
    total: int
    page: int
    page_size: int
