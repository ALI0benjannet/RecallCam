"""Fixed, inherited application roles. Permissions are enforced by the API."""

from enum import StrEnum


class Role(StrEnum):
    OPERATOR = "operator"
    SUPERVISOR = "supervisor"
    ADMINISTRATOR = "administrator"


class Permission(StrEnum):
    FOOTAGE_READ = "footage:read"
    QUERIES_CREATE = "queries:create"
    EVIDENCE_READ = "evidence:read"
    FEEDBACK_CREATE = "feedback:create"
    EVIDENCE_EXPORT = "evidence:export"
    AUDIT_READ = "audit:read"
    STANDING_QUERIES_MANAGE = "standing_queries:manage"
    USERS_MANAGE = "users:manage"
    CAMERAS_MANAGE = "cameras:manage"
    VIDEOS_MANAGE = "videos:manage"
    JOBS_MANAGE = "jobs:manage"
    RETENTION_MANAGE = "retention:manage"
    MODELS_MANAGE = "models:manage"


_OPERATOR = frozenset(
    {
        Permission.FOOTAGE_READ,
        Permission.QUERIES_CREATE,
        Permission.EVIDENCE_READ,
        Permission.FEEDBACK_CREATE,
    }
)
_SUPERVISOR = _OPERATOR | {
    Permission.EVIDENCE_EXPORT,
    Permission.AUDIT_READ,
    Permission.STANDING_QUERIES_MANAGE,
}
ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.OPERATOR: _OPERATOR,
    Role.SUPERVISOR: frozenset(_SUPERVISOR),
    Role.ADMINISTRATOR: frozenset(Permission),
}
