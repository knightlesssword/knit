"""Phase 3: milestones + tasks, progress, deletion guards, isolation."""
from __future__ import annotations


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


def _milestone(client, token, pid, name="M1", **overrides):
    payload = {"name": name}
    payload.update(overrides)
    res = client.post(
        f"/api/projects/{pid}/milestones", json=payload, headers=_auth(token)
    )
    assert res.status_code == 201, res.text
    return res.json()


def _task(client, token, pid, title="T", **overrides):
    payload = {"title": title}
    payload.update(overrides)
    res = client.post(f"/api/projects/{pid}/tasks", json=payload, headers=_auth(token))
    assert res.status_code == 201, res.text
    return res.json()


def test_task_belongs_to_project(client):
    token = _register(client, "ava@example.com")
    pid = _setup(client, token)
    body = _task(client, token, pid, title="Write copy", priority="high")
    assert body["project_id"] == pid
    assert body["milestone_id"] is None
    assert body["milestone_name"] is None
    assert body["project_name"] == "Site"
    assert body["status"] == "todo"
    assert body["completed_at"] is None


def test_task_belongs_to_milestone(client):
    token = _register(client, "ava@example.com")
    pid = _setup(client, token)
    ms = _milestone(client, token, pid, name="Launch")
    body = _task(client, token, pid, title="Ship it", milestone_id=ms["id"])
    assert body["milestone_id"] == ms["id"]
    assert body["milestone_name"] == "Launch"

    detail = client.get(f"/api/tasks/{body['id']}", headers=_auth(token))
    assert detail.status_code == 200
    assert detail.json()["milestone_name"] == "Launch"


def test_cross_project_milestone_rejected(client):
    token = _register(client, "ava@example.com")
    pid_a = _setup(client, token, "Alpha")
    pid_b = _setup(client, token, "Beta")
    ms = _milestone(client, token, pid_a, name="Alpha milestone")

    res = client.post(
        f"/api/projects/{pid_b}/tasks",
        json={"title": "Wrong home", "milestone_id": ms["id"]},
        headers=_auth(token),
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "task_milestone_mismatch"

    # Same rule on reassignment.
    task = _task(client, token, pid_b, title="Honest task")
    res = client.patch(
        f"/api/tasks/{task['id']}",
        json={"milestone_id": ms["id"]},
        headers=_auth(token),
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "task_milestone_mismatch"

    # Unknown milestone ids are 404, not 422.
    res = client.post(
        f"/api/projects/{pid_b}/tasks",
        json={"title": "Ghost", "milestone_id": 9999},
        headers=_auth(token),
    )
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "milestone_not_found"


def test_status_change_sets_and_clears_completed_at(client):
    token = _register(client, "ava@example.com")
    pid = _setup(client, token)
    task = _task(client, token, pid, title="Do it")

    done = client.patch(
        f"/api/tasks/{task['id']}", json={"status": "done"}, headers=_auth(token)
    )
    assert done.status_code == 200
    assert done.json()["completed_at"] is not None
    stamped = done.json()["completed_at"]

    # Re-marking done keeps the original timestamp.
    again = client.patch(
        f"/api/tasks/{task['id']}", json={"status": "done"}, headers=_auth(token)
    )
    assert again.json()["completed_at"] == stamped

    reopened = client.patch(
        f"/api/tasks/{task['id']}", json={"status": "in_progress"}, headers=_auth(token)
    )
    assert reopened.status_code == 200
    assert reopened.json()["status"] == "in_progress"
    assert reopened.json()["completed_at"] is None


def test_progress_null_then_exact_counts(client):
    token = _register(client, "ava@example.com")
    pid = _setup(client, token)

    empty = client.get(f"/api/projects/{pid}", headers=_auth(token))
    assert empty.json()["progress"] is None

    t1 = _task(client, token, pid, title="One")
    _task(client, token, pid, title="Two")
    _task(client, token, pid, title="Three")
    client.patch(f"/api/tasks/{t1['id']}", json={"status": "done"}, headers=_auth(token))

    got = client.get(f"/api/projects/{pid}", headers=_auth(token))
    assert got.json()["progress"] == {"total": 3, "done": 1}

    listed = client.get("/api/projects", headers=_auth(token))
    assert listed.json()[0]["progress"] == {"total": 3, "done": 1}

    patched = client.patch(
        f"/api/projects/{pid}", json={"name": "Renamed"}, headers=_auth(token)
    )
    assert patched.json()["progress"] == {"total": 3, "done": 1}


def test_milestone_counts(client):
    token = _register(client, "ava@example.com")
    pid = _setup(client, token)
    ms = _milestone(client, token, pid, name="M")
    assert ms["task_total"] == 0
    assert ms["task_done"] == 0

    t1 = _task(client, token, pid, title="A", milestone_id=ms["id"])
    _task(client, token, pid, title="B", milestone_id=ms["id"])
    _task(client, token, pid, title="Elsewhere")
    client.patch(f"/api/tasks/{t1['id']}", json={"status": "done"}, headers=_auth(token))

    detail = client.get(f"/api/milestones/{ms['id']}", headers=_auth(token))
    assert detail.json()["task_total"] == 2
    assert detail.json()["task_done"] == 1

    listed = client.get(f"/api/projects/{pid}/milestones", headers=_auth(token))
    assert [(m["name"], m["task_total"], m["task_done"]) for m in listed.json()] == [
        ("M", 2, 1)
    ]


def test_list_and_global_consistency(client):
    token = _register(client, "ava@example.com")
    pid = _setup(client, token)
    ms = _milestone(client, token, pid, name="M")
    a = _task(client, token, pid, title="A", milestone_id=ms["id"])
    b = _task(client, token, pid, title="B")

    scoped = client.get(f"/api/projects/{pid}/tasks", headers=_auth(token))
    assert [t["id"] for t in scoped.json()] == [a["id"], b["id"]]

    everything = client.get("/api/tasks", headers=_auth(token))
    assert [t["id"] for t in everything.json()] == [a["id"], b["id"]]
    by_id = {t["id"]: t for t in everything.json()}
    assert by_id[a["id"]]["milestone_name"] == "M"
    assert by_id[b["id"]]["milestone_name"] is None
    assert by_id[a["id"]]["project_name"] == "Site"


def test_milestone_delete_nulls_task_fk(client):
    token = _register(client, "ava@example.com")
    pid = _setup(client, token)
    ms = _milestone(client, token, pid, name="Doomed")
    task = _task(client, token, pid, title="Survivor", milestone_id=ms["id"])

    deleted = client.delete(f"/api/milestones/{ms['id']}", headers=_auth(token))
    assert deleted.status_code == 204

    got = client.get(f"/api/tasks/{task['id']}", headers=_auth(token))
    assert got.status_code == 200
    assert got.json()["milestone_id"] is None
    assert got.json()["milestone_name"] is None


def test_task_delete_ok(client):
    token = _register(client, "ava@example.com")
    pid = _setup(client, token)
    task = _task(client, token, pid, title="Temporary")

    assert client.delete(f"/api/tasks/{task['id']}", headers=_auth(token)).status_code == 204
    assert client.get(f"/api/tasks/{task['id']}", headers=_auth(token)).status_code == 404
    assert client.get(f"/api/projects/{pid}", headers=_auth(token)).json()["progress"] is None


def test_project_delete_blocked_with_work(client):
    token = _register(client, "ava@example.com")
    pid = _setup(client, token)

    # Empty project deletes fine.
    assert client.delete(f"/api/projects/{pid}", headers=_auth(token)).status_code == 204

    pid = _setup(client, token, "Busy")
    _task(client, token, pid, title="Work")
    blocked = client.delete(f"/api/projects/{pid}", headers=_auth(token))
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "project_has_work"
    assert client.get(f"/api/projects/{pid}", headers=_auth(token)).status_code == 200

    pid2 = _setup(client, token, "Milestoned")
    _milestone(client, token, pid2, name="Only a milestone")
    blocked = client.delete(f"/api/projects/{pid2}", headers=_auth(token))
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "project_has_work"

    # Archive stays the path for projects with work.
    archived = client.post(f"/api/projects/{pid}/archive", headers=_auth(token))
    assert archived.status_code == 200
    assert archived.json()["archived_at"] is not None


def test_cross_user_isolation(client):
    ava = _register(client, "ava@example.com")
    ben = _register(client, "ben@example.com")
    pid = _setup(client, ava)
    ms = _milestone(client, ava, pid, name="Private")
    task = _task(client, ava, pid, title="Secret", milestone_id=ms["id"])

    assert client.get(f"/api/projects/{pid}/milestones", headers=_auth(ben)).status_code == 404
    assert client.get(f"/api/projects/{pid}/tasks", headers=_auth(ben)).status_code == 404
    assert client.get(f"/api/milestones/{ms['id']}", headers=_auth(ben)).status_code == 404
    assert client.get(f"/api/tasks/{task['id']}", headers=_auth(ben)).status_code == 404
    assert client.get("/api/tasks", headers=_auth(ben)).json() == []
    assert (
        client.patch(
            f"/api/tasks/{task['id']}", json={"title": "Hijack"}, headers=_auth(ben)
        ).status_code
        == 404
    )
    assert client.delete(f"/api/tasks/{task['id']}", headers=_auth(ben)).status_code == 404
    assert (
        client.delete(f"/api/milestones/{ms['id']}", headers=_auth(ben)).status_code == 404
    )
    assert client.delete(f"/api/projects/{pid}", headers=_auth(ben)).status_code == 404
    # Ben cannot plant Ava's milestone onto his own project.
    ben_pid = _setup(client, ben, "Ben project")
    res = client.post(
        f"/api/projects/{ben_pid}/tasks",
        json={"title": "Theft", "milestone_id": ms["id"]},
        headers=_auth(ben),
    )
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "milestone_not_found"


def test_bad_enums_and_negative_estimate_rejected(client):
    token = _register(client, "ava@example.com")
    pid = _setup(client, token)

    for payload in ({"name": "M", "status": "nope"}, {"name": "M", "position": -1}):
        res = client.post(
            f"/api/projects/{pid}/milestones", json=payload, headers=_auth(token)
        )
        assert res.status_code == 422, res.text

    for payload in (
        {"title": "T", "status": "nope"},
        {"title": "T", "priority": "urgent"},
        {"title": "T", "estimated_duration_seconds": -5},
    ):
        res = client.post(f"/api/projects/{pid}/tasks", json=payload, headers=_auth(token))
        assert res.status_code == 422, (payload, res.text)

    res = client.post(
        f"/api/projects/{pid}/milestones", json={"name": "   "}, headers=_auth(token)
    )
    assert res.status_code == 422
    res = client.post(
        f"/api/projects/{pid}/tasks", json={"title": "  "}, headers=_auth(token)
    )
    assert res.status_code == 422
