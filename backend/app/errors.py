"""Structured error envelope: {"error": {"code": ..., "message": ...}}."""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

import logging

logger = logging.getLogger("knit")


def error_body(code: str, message: str) -> dict[str, Any]:
    return {"error": {"code": code, "message": message}}


def coded_error(status_code: int, code: str, message: str) -> HTTPException:
    """Raiseable HTTP error carrying a stable machine-readable code.

    The error handler below renders ``detail`` dicts with an explicit
    ``code``/``message`` into the standard envelope; plain string details
    keep the legacy status-derived codes.
    """
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail
        if isinstance(detail, dict) and "code" in detail:
            code = str(detail["code"])
            message = str(detail.get("message", code))
        else:
            code = {401: "unauthorized", 404: "not_found"}.get(exc.status_code, "request_error")
            message = str(detail)
        logger.warning(
            "http_error operation=%s path=%s status=%s",
            request.method,
            request.url.path,
            exc.status_code,
        )
        return JSONResponse(status_code=exc.status_code, content=error_body(code, message))

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
