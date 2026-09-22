"""Structured error envelope: {"error": {"code": ..., "message": ...}}."""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

import logging

logger = logging.getLogger("knit")


def error_body(code: str, message: str) -> dict[str, Any]:
    return {"error": {"code": code, "message": message}}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {401: "unauthorized", 404: "not_found"}.get(exc.status_code, "request_error")
        logger.warning(
            "http_error operation=%s path=%s status=%s",
            request.method,
            request.url.path,
            exc.status_code,
        )
        return JSONResponse(status_code=exc.status_code, content=error_body(code, str(exc.detail)))

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        logger.warning("validation_error path=%s errors=%s", request.url.path, exc.errors())
        return JSONResponse(
            status_code=422,
            content=error_body("validation_error", "request validation failed"),
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        # Never expose stack traces or internals to the frontend.
        logger.exception("internal_error path=%s error=%r", request.url.path, exc)
        return JSONResponse(
            status_code=500,
            content=error_body("internal_error", "something went wrong"),
        )
