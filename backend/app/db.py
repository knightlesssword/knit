"""SQLite engine/session + versioned migration runner.

Migrations are plain SQL files in app/migrations/ named NNN_name.sql.
Applied versions are tracked in schema_migrations(version INTEGER PRIMARY KEY).
Each migration runs inside a single transaction: fully applied or not at all.
"""
from __future__ import annotations

import logging
import os
import re
import sqlite3
from datetime import datetime, timezone

logger = logging.getLogger("knit.db")

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migrations")
_FILENAME_RE = re.compile(r"^(\d{3})_[a-z0-9_]+\.sql$")
assert _FILENAME_RE.match("001_init.sql")
assert not _FILENAME_RE.match("001_init.down.sql")


def _connect(db_path: str) -> sqlite3.Connection:
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path)
    # Never disable foreign-key enforcement (AGENTS.md section 5).
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def _ensure_version_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations "
        "(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)"
    )


def available_migrations() -> list[tuple[int, str]]:
    out: list[tuple[int, str]] = []
    if not os.path.isdir(MIGRATIONS_DIR):
        return out
    for name in sorted(os.listdir(MIGRATIONS_DIR)):
        m = _FILENAME_RE.match(name)
        if m:
            out.append((int(m.group(1)), os.path.join(MIGRATIONS_DIR, name)))
    return out


def applied_versions(conn: sqlite3.Connection) -> set[int]:
    _ensure_version_table(conn)
    return {row[0] for row in conn.execute("SELECT version FROM schema_migrations")}


def migrate(db_path: str) -> list[int]:
    """Apply pending migrations. Returns list of applied versions."""
    applied: list[int] = []
    conn = _connect(db_path)
    try:
        _ensure_version_table(conn)
        done = applied_versions(conn)
        for version, path in available_migrations():
            if version in done:
                continue
            with open(path, encoding="utf-8") as f:
                sql = f.read()
            logger.info("migrate_apply version=%d file=%s", version, os.path.basename(path))
            with conn:  # transaction: all-or-nothing per migration
                conn.executescript(sql)
                conn.execute(
                    "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
                    (version, datetime.now(timezone.utc).isoformat()),
                )
            applied.append(version)
        return applied
    finally:
        conn.close()


def get_connection(db_path: str) -> sqlite3.Connection:
    conn = _connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn
