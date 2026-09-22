"""Auth dependencies: current user from Bearer token."""
from __future__ import annotations

import logging

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User
from .security import decode_token

logger = logging.getLogger("knit.auth")


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),  # noqa: B008
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="authentication required")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_token(token, settings.secret_key)
        user_id = int(payload.get("sub", "0"))
    except Exception:
        logger.warning("auth_token_invalid")
        raise HTTPException(status_code=401, detail="invalid or expired token") from None
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="invalid or expired token")
    return user
