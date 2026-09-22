from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..errors import error_body
from ..models import User
from ..schemas import LoginIn, RegisterIn, TokenOut, UserOut
from ..security import create_token, hash_password, verify_password

logger = logging.getLogger("knit.auth")
router = APIRouter(prefix="/auth")


def _public_user(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):  # noqa: B008, ANN201
    now = datetime.now(timezone.utc).isoformat()
    user = User(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        logger.warning("register_conflict resource=user identifier=%s", body.email)
        return JSONResponse(
            status_code=409,
            content=error_body("user_exists", "an account with this email already exists"),
        )
    db.refresh(user)
    logger.info("register_ok resource=user identifier=%s", user.id)
    token = create_token(user.id, user.email, settings.secret_key, settings.token_expiry_days)
    return {"token": token, "user": _public_user(user)}


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):  # noqa: B008, ANN201
    # identifier is the email address (lowercased by schema). Single-user local
    # app: one row per install in practice; uniqueness enforced by DB.
    user = db.query(User).filter(User.email == body.identifier).one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        logger.warning("login_failed resource=user identifier=%s", body.identifier)
        return JSONResponse(
            status_code=401,
            content=error_body("invalid_credentials", "email or password is incorrect"),
        )
    logger.info("login_ok resource=user identifier=%s", user.id)
    token = create_token(user.id, user.email, settings.secret_key, settings.token_expiry_days)
    return {"token": token, "user": _public_user(user)}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:  # noqa: B008
    return user
