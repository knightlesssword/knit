"""Phase 4: time entries, timesheet week summaries, task delete guard."""
from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from datetime import date, timedelta


def _register(client, email):
    res = client.post(
        "/api/auth/register",
        json={"name": "U", "email": email, "password": "password123"},
    )
    assert res.status_code == 201, res.text
    return res.json()["token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _setup(client, token, project_name="Site"):
    res = client.post("/api/clients", json={"name": "Acme"}, headers=_auth(token))
    assert res.status_code == 201, res.text
    cid = res.json()["id"]
    res = client.post(
        "/api/projects",
        json={
            "name": project_name,
            "client_id": cid,
            "project_type": "fixed_price",
            "currency": "USD",
        },
        headers=_auth(token),
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _task(client, token, pid, title="T", **overrides):
    payload = {"title": title}
    payload.update(overrides)
    res = client.post(f"/api/projects/{pid}/tasks", json=payload, headers=_auth(token))
    assert res.status_code == 201, res.text
    return res.json()


def _entry(client, token, pid, **overrides):
    payload = {"entry_date": "2026-09-21", "duration_seconds": 3600}
    payload.update(overrides)
    res = client.post(
        f"/api/projects/{pid}/time-entries", json=payload, headers=_auth(token)
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_create_edit_delete_flow(client):
    token = _register(client, "ava@example.com")
    pid = _setup(client, token)

    created = _entry(
        client, token, pid, entry_date="2026-09-21", duration_seconds=5400,
        description="Deep work", billable=True,
    )
    assert created["project_id"] == pid
    assert created["task_id"] is None
    assert created["task_title"] is None
    assert created["project_name"] == "Site"
    assert created["entry_date"] == "2026-09-21"
    assert created["duration_seconds"] == 5400
    assert created["billable"] is True

    # Blank descriptions normalize to null.
    blank = _entry(client, token, pid, description="   ")
    assert blank["description"] is None

    listed = client.get(f"/api/projects/{pid}/time-entries", headers=_auth(token))
    assert listed.status_code == 200
    assert [e["id"] for e in listed.json()] == [created["id"], blank["id"]]

    got = client.get(f"/api/time-entries/{created['id']}", headers=_auth(token))
    assert got.status_code == 200
    assert got.json()["duration_seconds"] == 5400

    patched = client.patch(
        f"/api/time-entries/{created['id']}",
        json={"duration_seconds": 7200, "billable": False},
        headers=_auth(token),
    )
    assert patched.status_code == 200
    assert patched.json()["duration_seconds"] == 7200
    assert patched.json()["billable"] is False

    deleted = client.delete(f"/api/time-entries/{created['id']}", headers=_auth(token))
    assert deleted.status_code == 204
    assert client.get(f"/api/time-entries/{created['id']}", headers=_auth(token)).status_code == 404


def test_task_association_and_mismatch(client):
    token = _register(client, "ava@example.com")
    pid_a = _setup(client, token, "Alpha")
    pid_b = _setup(client, token, "Beta")
    task_a = _task(client, token, pid_a, title="Alpha task")
    task_b = _task(client, token, pid_b, title="Beta task")

    linked = _entry(client, token, pid_a, task_id=task_a["id"])
    assert linked["task_id"] == task_a["id"]
    assert linked["task_title"] == "Alpha task"

    # Task from another project is rejected with the mismatch code.
    res = client.post(
        f"/api/projects/{pid_a}/time-entries",
        json={"entry_date": "2026-09-21", "duration_seconds": 60, "task_id": task_b["id"]},
        headers=_auth(token),
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "entry_task_mismatch"

    # Same rule on reassignment via PATCH.
    res = client.patch(
        f"/api/time-entries/{linked['id']}",
        json={"task_id": task_b["id"]},
        headers=_auth(token),
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "entry_task_mismatch"

    # Unknown task ids are 404, not 422.
    res = client.post(
        f"/api/projects/{pid_a}/time-entries",
        json={"entry_date": "2026-09-21", "duration_seconds": 60, "task_id": 9999},
        headers=_auth(token),
    )
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "task_not_found"

    # Clearing the link works.
    cleared = client.patch(
        f"/api/time-entries/{linked['id']}", json={"task_id": None}, headers=_auth(token)
    )
    assert cleared.status_code == 200
    assert cleared.json()["task_id"] is None
    assert cleared.json()["task_title"] is None


def test_scoping_and_isolation(client):
    ava = _register(client, "ava@example.com")
    ben = _register(client, "ben@example.com")
    pid = _setup(client, ava)
    entry = _entry(client, ava, pid)

    assert client.get(f"/api/projects/{pid}/time-entries", headers=_auth(ben)).status_code == 404
    assert client.get(f"/api/time-entries/{entry['id']}", headers=_auth(ben)).status_code == 404
    assert client.get("/api/time-entries", headers=_auth(ben)).json() == []
    assert (
        client.patch(
            f"/api/time-entries/{entry['id']}",
            json={"duration_seconds": 5},
            headers=_auth(ben),
        ).status_code
        == 404
    )
    assert client.delete(f"/api/time-entries/{entry['id']}", headers=_auth(ben)).status_code == 404
    # Ben's entry still works and sees only his own data.
    ben_pid = _setup(client, ben, "Ben project")
    ben_entry = _entry(client, ben, ben_pid)
    assert [e["id"] for e in client.get("/api/time-entries", headers=_auth(ben)).json()] == [
        ben_entry["id"]
    ]
    # Ben cannot attach Ava's task to his entry.
    task = _task(client, ava, pid, title="Secret")
    res = client.post(
        f"/api/projects/{ben_pid}/time-entries",
        json={"entry_date": "2026-09-21", "duration_seconds": 60, "task_id": task["id"]},
        headers=_auth(ben),
    )
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "task_not_found"


def test_filters(client):
    token = _register(client, "ava@example.com")
    pid_a = _setup(client, token, "Alpha")
    pid_b = _setup(client, token, "Beta")
    task = _task(client, token, pid_a, title="Linked")
    billable_a = _entry(
        client, token, pid_a, entry_date="2026-09-21", duration_seconds=3600,
        billable=True, task_id=task["id"],
    )
    non_billable_a = _entry(
        client, token, pid_a, entry_date="2026-09-22", duration_seconds=1800,
        billable=False,
    )
    other_project = _entry(
        client, token, pid_b, entry_date="2026-09-21", duration_seconds=900,
    )

    def ids(query):
        res = client.get(f"/api/time-entries{query}", headers=_auth(token))
        assert res.status_code == 200, res.text
        return [e["id"] for e in res.json()]

    assert ids(f"?project_id={pid_a}") == [billable_a["id"], non_billable_a["id"]]
    assert ids(f"?task_id={task['id']}") == [billable_a["id"]]
    assert ids("?billable=true") == [billable_a["id"], other_project["id"]]
    assert ids("?billable=false") == [non_billable_a["id"]]
    assert ids("?from=2026-09-22") == [non_billable_a["id"]]
    assert ids("?to=2026-09-21") == [billable_a["id"], other_project["id"]]
    assert ids("?from=2026-09-21&to=2026-09-21") == [billable_a["id"], other_project["id"]]
    assert ids(f"?project_id={pid_a}&billable=false") == [non_billable_a["id"]]

    # Unknown or foreign filter ids are 404, never silently empty.
    res = client.get("/api/time-entries?project_id=9999", headers=_auth(token))
    assert res.status_code == 404
    ben = _register(client, "ben@example.com")
    res = client.get(f"/api/time-entries?project_id={pid_a}", headers=_auth(ben))
    assert res.status_code == 404
    res = client.get("/api/time-entries?task_id=9999", headers=_auth(token))
    assert res.status_code == 404


def test_week_summary_math_and_monday_snap(client):
    token = _register(client, "ava@example.com")
    pid_a = _setup(client, token, "Alpha")
    pid_b = _setup(client, token, "Beta")
    # Week of Mon 2026-09-21 .. Sun 2026-09-27.
    _entry(client, token, pid_a, entry_date="2026-09-21", duration_seconds=3600, billable=True)
    _entry(client, token, pid_a, entry_date="2026-09-21", duration_seconds=1800, billable=False)
    _entry(client, token, pid_b, entry_date="2026-09-23", duration_seconds=5400, billable=True)
    # Outside the week: must not leak in.
    _entry(client, token, pid_a, entry_date="2026-09-20", duration_seconds=9999)
    _entry(client, token, pid_a, entry_date="2026-09-28", duration_seconds=9999)

    # Mid-week input snaps back to Monday.
    res = client.get("/api/timesheet?week_start=2026-09-24", headers=_auth(token))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["week_start"] == "2026-09-21"
    assert [d["date"] for d in body["days"]] == [
        "2026-09-21",
        "2026-09-22",
        "2026-09-23",
        "2026-09-24",
        "2026-09-25",
        "2026-09-26",
        "2026-09-27",
    ]
    monday = body["days"][0]
    assert monday == {
        "date": "2026-09-21",
        "total_seconds": 5400,
        "billable_seconds": 3600,
        "non_billable_seconds": 1800,
    }
    wednesday = body["days"][2]
    assert wednesday["total_seconds"] == 5400
    assert wednesday["billable_seconds"] == 5400
    assert wednesday["non_billable_seconds"] == 0
    # Zero days are present with explicit zeros.
    assert body["days"][1]["total_seconds"] == 0
    assert body["days"][1]["billable_seconds"] == 0
    assert body["days"][6] == {
        "date": "2026-09-27",
        "total_seconds": 0,
        "billable_seconds": 0,
        "non_billable_seconds": 0,
    }
    assert body["week_total_seconds"] == 10800
    assert body["week_billable_seconds"] == 9000
    assert body["week_non_billable_seconds"] == 1800
    assert body["by_project"] == [
        {"project_id": pid_a, "project_name": "Alpha", "total_seconds": 5400},
        {"project_id": pid_b, "project_name": "Beta", "total_seconds": 5400},
    ]

    # A Sunday input belongs to the same week.
    res = client.get("/api/timesheet?week_start=2026-09-27", headers=_auth(token))
    assert res.json()["week_start"] == "2026-09-21"

    # An empty week is all zeros, no projects.
    res = client.get("/api/timesheet?week_start=2026-01-05", headers=_auth(token))
    empty = res.json()
    assert empty["week_total_seconds"] == 0
    assert empty["by_project"] == []
    assert len(empty["days"]) == 7
    assert all(d["total_seconds"] == 0 for d in empty["days"])

    # Missing week_start is a validation error, not a 500.
    assert client.get("/api/timesheet", headers=_auth(token)).status_code == 422


def test_duration_and_date_validation(client):
    token = _register(client, "ava@example.com")
    pid = _setup(client, token)

    for bad in (0, -5):
        res = client.post(
            f"/api/projects/{pid}/time-entries",
            json={"entry_date": "2026-09-21", "duration_seconds": bad},
            headers=_auth(token),
        )
        assert res.status_code == 422, (bad, res.text)
    res = client.post(
        f"/api/projects/{pid}/time-entries",
        json={"entry_date": "not-a-date", "duration_seconds": 60},
        headers=_auth(token),
    )
    assert res.status_code == 422

    entry = _entry(client, token, pid)
    res = client.patch(
        f"/api/time-entries/{entry['id']}",
        json={"duration_seconds": 0},
        headers=_auth(token),
    )
    assert res.status_code == 422

    # Validation failures must not log submitted input values.
    assert "password123" not in (res.text or "")


def test_validation_errors_do_not_log_input_values(client, caplog):
    import logging

    secret = "s3cret-pw-value-xyz"
    with caplog.at_level(logging.WARNING, logger="knit"):
        res = client.post(
            "/api/auth/register",
            json={"name": "U", "email": "not-an-email", "password": secret},
        )
    assert res.status_code == 422
    assert secret not in caplog.text
    assert "validation_error" in caplog.text


def test_task_delete_blocked_with_time(client):
    token = _register(client, "ava@example.com")
    pid = _setup(client, token)
    task = _task(client, token, pid, title="Tracked")
    entry = _entry(client, token, pid, task_id=task["id"])

    blocked = client.delete(f"/api/tasks/{task['id']}", headers=_auth(token))
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "task_has_time"
    assert client.get(f"/api/tasks/{task['id']}", headers=_auth(token)).status_code == 200

    # Removing the time entry unblocks deletion.
    assert client.delete(f"/api/time-entries/{entry['id']}", headers=_auth(token)).status_code == 204
    assert client.delete(f"/api/tasks/{task['id']}", headers=_auth(token)).status_code == 204

    # A project holding time entries cannot be deleted either (archive instead).
    pid2 = _setup(client, token, "Logged")
    _entry(client, token, pid2)
    blocked = client.delete(f"/api/projects/{pid2}", headers=_auth(token))
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "project_has_work"


def test_seed_script(tmp_path):
    db_path = tmp_path / "seed.db"
    env = {
        **os.environ,
        "KNIT_DATABASE_PATH": str(db_path),
        "PYTHONPATH": os.path.abspath(os.path.join(os.path.dirname(__file__), "..")),
    }
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    run = lambda *args: subprocess.run(
        [sys.executable, "scripts/seed.py", *args],
        cwd=backend_dir,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )

    first = run()
    assert first.returncode == 0, first.stderr
    assert "dev@knit.local" in first.stdout

    # Refuses a non-empty DB without --reset.
    again = run()
    assert again.returncode != 0
    assert "--reset" in (again.stdout + again.stderr)

    conn = sqlite3.connect(str(db_path))
    try:
        counts = {
            table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in (
                "users",
                "clients",
                "projects",
                "milestones",
                "tasks",
                "time_entries",
            )
        }
        billable = conn.execute(
            "SELECT COUNT(*) FROM time_entries WHERE billable = 1"
        ).fetchone()[0]
        non_billable = conn.execute(
            "SELECT COUNT(*) FROM time_entries WHERE billable = 0"
        ).fetchone()[0]
        types = {
            r[0] for r in conn.execute("SELECT DISTINCT project_type FROM projects")
        }
        done = conn.execute(
            "SELECT COUNT(*) FROM tasks WHERE status = 'done'"
        ).fetchone()[0]
        weeks = {
            r[0] for r in conn.execute("SELECT DISTINCT substr(entry_date, 1, 10) FROM time_entries")
        }
    finally:
        conn.close()
    assert counts["users"] == 1
    assert counts["clients"] == 1
    assert counts["projects"] == 3
    assert counts["milestones"] >= 1
    assert counts["tasks"] >= 4
    assert counts["time_entries"] >= 4
    assert billable >= 1 and non_billable >= 1
    assert types == {"fixed_price", "hourly", "retainer"}
    assert done >= 1
    monday_weeks = {date.fromisoformat(d) - timedelta(days=date.fromisoformat(d).weekday()) for d in weeks}
    assert len(monday_weeks) == 2

    # --reset wipes and reseeds deterministically.
    reset = run("--reset")
    assert reset.returncode == 0, reset.stderr
    conn = sqlite3.connect(str(db_path))
    try:
        reseeded = {
            table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in ("users", "clients", "projects", "tasks", "time_entries")
        }
    finally:
        conn.close()
    assert reseeded == {k: counts[k] for k in reseeded}
