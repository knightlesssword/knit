"""Migration system: deterministic, versioned, FK-enforced, model parity."""
from __future__ import annotations

import sqlite3

from app import models
from app.database import Base
from app.db import applied_versions, get_connection, migrate


def _tables(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    return {r[0] for r in rows}


def test_migrate_applies_v1_and_is_idempotent(tmp_path):
    db_path = str(tmp_path / "m.db")
    assert migrate(db_path) == [1]
    assert migrate(db_path) == []
    conn = get_connection(db_path)
    try:
        assert "users" in _tables(conn)
        assert "schema_migrations" in _tables(conn)
        assert applied_versions(conn) == {1}
    finally:
        conn.close()


def test_foreign_keys_enforced(tmp_path):
    db_path = str(tmp_path / "fk.db")
    migrate(db_path)
    conn = get_connection(db_path)
    try:
        assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    finally:
        conn.close()


def test_models_match_migrated_schema(tmp_path):
    """SQLAlchemy models must reflect the migrated schema (migrations authoritative)."""
    db_path = str(tmp_path / "parity.db")
    migrate(db_path)
    conn = get_connection(db_path)
    try:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()}
    finally:
        conn.close()
    model_cols = {c.name for c in models.User.__table__.columns}
    assert model_cols == cols, f"model={model_cols} db={cols}"
    assert set(Base.metadata.tables) == {"users"}
