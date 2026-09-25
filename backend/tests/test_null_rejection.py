"""Null-rejection sweep: explicit null on non-clearable PATCH fields is a 422,
never a 500. Added during the post-phase-4 consistency sweep."""
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


def _setup(client, token):
    res = client.post("/api/clients", json={"name": "Acme"}, headers=_auth(token))
    assert res.status_code == 201, res.text
    cid = res.json()["id"]
    res = client.post(
        "/api/projects",
        json={
            "name": "Site",
            "client_id": cid,
            "project_type": "fixed_price",
            "currency": "USD",
        },
        headers=_auth(token),
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def test_patch_explicit_null_rejected_on_tasks_and_milestones(client):
    token = _register(client, "ava@example.com")
    pid = _setup(client, token)
    milestone = client.post(
        f"/api/projects/{pid}/milestones", json={"name": "M1"}, headers=_auth(token)
    ).json()
    task = client.post(
        f"/api/projects/{pid}/tasks", json={"title": "T"}, headers=_auth(token)
    ).json()

    for path, field in (
        (f"/api/tasks/{task['id']}", "title"),
        (f"/api/tasks/{task['id']}", "status"),
        (f"/api/tasks/{task['id']}", "priority"),
        (f"/api/milestones/{milestone['id']}", "name"),
        (f"/api/milestones/{milestone['id']}", "status"),
    ):
        res = client.patch(path, json={field: None}, headers=_auth(token))
        assert res.status_code == 422, (path, field, res.text)
        assert res.json()["error"]["code"] == "validation_error"
    # rows untouched, no 500
    assert client.get(f"/api/tasks/{task['id']}", headers=_auth(token)).status_code == 200


def test_patch_explicit_null_rejected_on_time_entries(client):
    token = _register(client, "ava@example.com")
    pid = _setup(client, token)
    entry = client.post(
        f"/api/projects/{pid}/time-entries",
        json={"entry_date": "2026-09-21", "duration_seconds": 3600},
        headers=_auth(token),
    ).json()

    for field in ("entry_date", "duration_seconds", "billable"):
        res = client.patch(
            f"/api/time-entries/{entry['id']}", json={field: None}, headers=_auth(token)
        )
        assert res.status_code == 422, (field, res.text)
        assert res.json()["error"]["code"] == "validation_error"
    # clearing the description (genuinely nullable) still works
    cleared = client.patch(
        f"/api/time-entries/{entry['id']}",
        json={"description": None},
        headers=_auth(token),
    )
    assert cleared.status_code == 200
