"""API entry point. No databases or models are initialized at import time."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from recallcam_backend.routes import health, queries
from recallcam_shared.settings import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(title="RecallCam API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type", "Authorization"],
    )
    app.include_router(health.router)
    app.include_router(queries.router, prefix="/api")
    return app


app = create_app()
