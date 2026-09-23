"""knit backend: local-first FastAPI + SQLite. Phase 0: health + auth foundation."""
from __future__ import annotations

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .config import settings
from .db import migrate
from .errors import register_error_handlers
from .routers.auth import router as auth_router
from .routers.clients import router as clients_router
from .routers.health import router as health_router
from .routers.projects import router as projects_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("knit")


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if not os.environ.get("KNIT_SECRET_KEY"):
            logger.warning("using default dev secret key; set KNIT_SECRET_KEY")
        applied = migrate(settings.database_path)
        logger.info(
            "startup_ok db=%s migrations_applied=%s",
            os.path.abspath(settings.database_path),
            applied,
        )
        yield

    app = FastAPI(title="knit", version=settings.app_version, lifespan=lifespan)
    register_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router, prefix="/api")
    app.include_router(auth_router, prefix="/api")
    app.include_router(clients_router, prefix="/api")
    app.include_router(projects_router, prefix="/api")

    return app


app = create_app()
