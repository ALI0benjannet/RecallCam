"""API entry point. Migrations and account bootstrap are explicit CLI actions."""

from contextlib import asynccontextmanager
from secrets import token_urlsafe

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.routing import APIRoute
from sqlalchemy.exc import SQLAlchemyError
from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse
from starlette.routing import Route

from recallcam_backend.middleware import AuthenticationMiddleware, RoleMiddleware
from recallcam_backend.routes import audit, auth, cameras, health, queries, services, users, videos
from recallcam_backend.security import TokenService, hash_password
from recallcam_shared.media import InvalidMedia, MediaToolUnavailable
from recallcam_shared.database.connection import create_database_engine, create_session_factory
from recallcam_shared.settings import Settings
from recallcam_shared.storage.s3 import StorageUnavailable


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = create_database_engine(settings)
        app.state.session_factory = create_session_factory(engine)
        app.state.tokens = TokenService(settings)
        app.state.dummy_password_hash = await run_in_threadpool(hash_password, token_urlsafe(32))
        try:
            yield
        finally:
            await run_in_threadpool(engine.dispose)

    app = FastAPI(title="RecallCam API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.api_policies = []

    @app.exception_handler(SQLAlchemyError)
    async def database_unavailable(request: Request, error: SQLAlchemyError) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={"detail": "The application database is unavailable. Try again shortly."},
        )

    @app.exception_handler(StorageUnavailable)
    @app.exception_handler(MediaToolUnavailable)
    async def media_service_unavailable(request: Request, error: Exception) -> JSONResponse:
        return JSONResponse(status_code=503, content={"detail": str(error)})

    @app.exception_handler(InvalidMedia)
    async def invalid_media(request: Request, error: InvalidMedia) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": str(error)})

    def register_api_router(router: APIRouter) -> None:
        for route in router.routes:
            if isinstance(route, APIRoute):
                app.state.api_policies.append(
                    Route("/api" + route.path, endpoint=route.endpoint, methods=route.methods)
                )
        app.include_router(router, prefix="/api")

    app.include_router(health.router)
    for router in (
        auth.router,
        users.router,
        cameras.router,
        videos.router,
        audit.router,
        services.router,
        queries.router,
    ):
        register_api_router(router)

    # Starlette wraps in reverse registration order: CORS -> authentication -> roles -> route.
    app.add_middleware(RoleMiddleware)
    app.add_middleware(AuthenticationMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    def openapi_schema() -> dict:
        if app.openapi_schema is None:
            schema = get_openapi(title=app.title, version=app.version, routes=app.routes)
            schema.setdefault("components", {}).setdefault("securitySchemes", {})["BearerAuth"] = {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
            }
            for path, operations in schema.get("paths", {}).items():
                if path.startswith("/api/") and path != "/api/auth/login":
                    for operation in operations.values():
                        if isinstance(operation, dict):
                            operation["security"] = [{"BearerAuth": []}]
            app.openapi_schema = schema
        return app.openapi_schema

    app.openapi = openapi_schema
    return app


app = create_app()
