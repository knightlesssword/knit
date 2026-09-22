"""SQLAlchemy engine/session. Migrations stay authoritative plain SQL (app/db.py);
models here must match the migrated schema. A startup check enforces parity.
"""
from __future__ import annotations

import os
from typing import Iterator

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from .config import settings

Base = declarative_base()


def _db_url(db_path: str | None = None) -> str:
    path = os.path.abspath(db_path or settings.database_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return f"sqlite:///{path}"


def create_engine_for(db_path: str | None = None) -> Engine:
    from sqlalchemy import create_engine

    engine = create_engine(_db_url(db_path), connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _enforce_pragmas(dbapi_conn, _):  # noqa: ANN001, ANN202
        cursor = dbapi_conn.cursor()
        # Never disable foreign-key enforcement.
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.execute("PRAGMA journal_mode = WAL")
        cursor.close()

    return engine


engine = create_engine_for()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
