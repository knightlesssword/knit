"""Dev-only seed data for local development and manual UI inspection.

NOT for production: creates a fixed demo user plus a small deterministic
fixture (1 client, 3 projects, milestones, tasks, time entries). Run from
backend/ as::

    python scripts/seed.py            # refuses if the DB already has users
    python scripts/seed.py --reset    # deletes the DB file first, then seeds

The database path comes from KNIT_DATABASE_PATH or the app default.
No new dependencies: stdlib sqlite3 plus existing app modules only.
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings  # noqa: E402
from app.db import get_connection, migrate  # noqa: E402
from app.security import hash_password  # noqa: E402

SEED_EMAIL = "dev@knit.local"
SEED_PASSWORD = "dev-knit-123"
SEED_NAME = "Dev"


def _db_path() -> str:
    return os.environ.get("KNIT_DATABASE_PATH", settings.database_path)


def _wipe(db_path: str) -> None:
    for suffix in ("", "-wal", "-shm", "-journal"):
        try:
            os.remove(db_path + suffix)
        except FileNotFoundError:
            pass


def _user_count(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]


def _now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


def seed(conn: sqlite3.Connection) -> dict[str, int]:
    now = _now_iso()
    cur = conn.cursor()

    cur.execute(
        "INSERT INTO users (name, email, password_hash, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, ?)",
        (SEED_NAME, SEED_EMAIL, hash_password(SEED_PASSWORD), now, now),
    )
    user_id = cur.lastrowid
    assert user_id is not None

    cur.execute(
        "INSERT INTO clients (user_id, name, company, email, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, "Acme Studio", "Acme Ltd", "hello@acme.example", now, now),
    )
    client_id = cur.lastrowid

    projects = [
        ("Website redesign", "fixed_price", "USD", 500000, None, None),
        ("Bookkeeping", "hourly", "GBP", None, 7500, None),
        ("Support retainer", "retainer", "INR", None, None, 200000),
    ]
    project_ids: list[int] = []
    for name, ptype, currency, budget, hourly_rate, recurring in projects:
        cur.execute(
            "INSERT INTO projects (user_id, client_id, name, project_type, status,"
            " currency, budget, hourly_rate, recurring_amount, start_date,"
            " created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)",
            (
                user_id,
                client_id,
                name,
                ptype,
                currency,
                budget,
                hourly_rate,
                recurring,
                date.today().isoformat(),
                now,
                now,
            ),
        )
        project_ids.append(cur.lastrowid)
    p1, p2, p3 = project_ids

    cur.execute(
        "INSERT INTO milestones (user_id, project_id, name, status, position,"
        " created_at, updated_at) VALUES (?, ?, 'Launch', 'open', 0, ?, ?)",
        (user_id, p1, now, now),
    )
    m1 = cur.lastrowid
    cur.execute(
        "INSERT INTO milestones (user_id, project_id, name, status, position,"
        " created_at, updated_at) VALUES (?, ?, 'Month close', 'open', 0, ?, ?)",
        (user_id, p2, now, now),
    )
    m2 = cur.lastrowid

    tasks = [
        # (project, milestone, title, status, completed?)
        (p1, m1, "Design homepage", "done", True),
        (p1, m1, "Build contact page", "in_progress", False),
        (p1, None, "Write launch copy", "todo", False),
        (p2, m2, "Reconcile ledger", "in_progress", False),
        (p2, None, "File quarterly return", "todo", False),
        (p3, None, "Triage support inbox", "todo", False),
        (p3, None, "Monthly status report", "done", True),
    ]
    task_ids: list[int] = []
    for project_id, milestone_id, title, status, done in tasks:
        cur.execute(
            "INSERT INTO tasks (user_id, project_id, milestone_id, title, status,"
            " priority, completed_at, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, 'medium', ?, ?, ?)",
            (
                user_id,
                project_id,
                milestone_id,
                title,
                status,
                now if done else None,
                now,
                now,
            ),
        )
        task_ids.append(cur.lastrowid)

    # Time entries spread across last week and this week, billable and not,
    # some linked to tasks and some project-only. Dates snap to Mondays so
    # the demo always shows data in "this week" / "last week".
    today = date.today()
    this_monday = today - timedelta(days=today.weekday())
    last_monday = this_monday - timedelta(days=7)
    entries = [
        # (project, task_index|None, date, seconds, billable, description)
        (p1, 0, last_monday, 7200, 1, "Homepage design session"),
        (p2, 3, last_monday + timedelta(days=1), 5400, 0, "Internal review, non-billable"),
        (p1, None, last_monday + timedelta(days=4), 10800, 1, "Launch prep"),
        (p3, 5, this_monday, 3600, 1, "Inbox triage"),
        (p2, 4, this_monday + timedelta(days=2), 2700, 1, "Return paperwork"),
        (p1, 1, this_monday + timedelta(days=3), 4500, 0, "Pro-bono polish"),
    ]
    for project_id, task_idx, day, seconds, billable, description in entries:
        cur.execute(
            "INSERT INTO time_entries (user_id, project_id, task_id, entry_date,"
            " duration_seconds, description, billable, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                user_id,
                project_id,
                task_ids[task_idx] if task_idx is not None else None,
                day.isoformat(),
                seconds,
                description,
                billable,
                now,
                now,
            ),
        )
    conn.commit()
    return {
        "users": 1,
        "clients": 1,
        "projects": len(project_ids),
        "milestones": 2,
        "tasks": len(task_ids),
        "time_entries": len(entries),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed a dev database for knit.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="delete the existing DB file first (otherwise refuse non-empty DBs)",
    )
    args = parser.parse_args()

    db_path = _db_path()
    if args.reset:
        _wipe(os.path.abspath(db_path))
    migrate(db_path)
    conn = get_connection(db_path)
    try:
        existing = _user_count(conn)
        if existing and not args.reset:
            print(
                f"refusing: database already has {existing} user(s) "
                f"({os.path.abspath(db_path)}). Use --reset to reseed."
            )
            return 1
        counts = seed(conn)
    finally:
        conn.close()
    print(f"seeded {os.path.abspath(db_path)}: " + ", ".join(f"{k}={v}" for k, v in counts.items()))
    print(f"login: {SEED_EMAIL} / {SEED_PASSWORD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
