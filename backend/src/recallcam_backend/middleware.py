"""Separate authentication and role middleware, with default-deny API route policies."""

from fastapi import HTTPException, Request
from sqlalchemy.exc import SQLAlchemyError
from starlette._utils import get_route_path
from starlette.concurrency import run_in_threadpool
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response
from starlette.routing import Match, Route

from recallcam_backend.security import Principal, unauthorized
from recallcam_shared.contracts.access import ROLE_PERMISSIONS
from recallcam_shared.database.models import User


def matched_api_route(request: Request) -> Route | None:
    # Explicit registration avoids depending on FastAPI's lazy included-router internals.
    for route in request.app.state.api_policies:
        match, _ = route.matches(request.scope)
        if match == Match.FULL:
            return route
    return None


def is_api_request(request: Request) -> bool:
    # Use the same root_path-aware path as Starlette route matching behind reverse proxies.
    path = get_route_path(request.scope)
    return path == "/api" or path.startswith("/api/")


def error_response(error: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code, content={"detail": error.detail}, headers=error.headers
    )


class AuthenticationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not is_api_request(request):
            return await call_next(request)
        route = matched_api_route(request)
        if route is not None and getattr(route.endpoint, "__recallcam_public__", False):
            return await call_next(request)
        try:
            scheme, _, token = request.headers.get("Authorization", "").partition(" ")
            if scheme.lower() != "bearer" or not token.strip() or len(token) > 8192:
                raise unauthorized()

            def authenticate() -> Principal:
                user_id, version = request.app.state.tokens.validate(token.strip())
                with request.app.state.session_factory() as session:
                    user = session.get(User, user_id)
                    if user is None or not user.is_active or user.auth_version != version:
                        raise unauthorized()
                    return Principal.from_user(user)

            request.state.user = await run_in_threadpool(authenticate)
        except HTTPException as error:
            return error_response(error)
        except SQLAlchemyError:
            return JSONResponse(
                status_code=503,
                content={"detail": "The application database is unavailable. Try again shortly."},
            )
        return await call_next(request)


class RoleMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not is_api_request(request):
            return await call_next(request)
        route = matched_api_route(request)
        if route is not None and getattr(route.endpoint, "__recallcam_public__", False):
            return await call_next(request)
        principal = getattr(request.state, "user", None)
        if principal is None:
            return error_response(unauthorized())
        endpoint = route.endpoint if route is not None else None
        permission = getattr(endpoint, "__recallcam_permission__", None)
        authenticated_only = getattr(endpoint, "__recallcam_authenticated__", False)
        if permission is None and not authenticated_only:
            return JSONResponse(
                status_code=403, content={"detail": "Access to this feature is not configured."}
            )
        if permission is not None and permission not in ROLE_PERMISSIONS[principal.role]:
            return JSONResponse(
                status_code=403,
                content={"detail": "Your role does not have permission to perform this action."},
            )
        return await call_next(request)
