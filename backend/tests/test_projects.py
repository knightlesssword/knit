"""Phase 2: project CRUD scoped to the authenticated user, plus client guards."""
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


def _client_id(client, token, name="Acme"):
    res = client.post("/api/clients", json={"name": name}, headers=_auth(token))
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _project_payload(client_id, **overrides):
    payload = {
        "name": "Website redesign",
        "client_id": client_id,
        "project_type": "fixed_price",
        "currency": "USD",
    }
    payload.update(overrides)
    return payload


def _create_project(client, token, client_id, **overrides):
    res = client.post(
        "/api/projects", json=_project_payload(client_id, **overrides), headers=_auth(token)
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_projects_require_auth(client):
    assert client.get("/api/projects").status_code == 401
    res = client.post(
        "/api/projects",
        json={"name": "P", "client_id": 1, "project_type": "hourly", "currency": "USD"},
    )
    assert res.status_code == 401


def test_create_project_under_own_client(client):
    token = _register(client, "ava@example.com")
    cid = _client_id(client, token)
    body = _create_project(
        client,
        token,
        cid,
        description="Marketing site",
        budget=425000,
        start_date="2026-10-01",
        due_date="2026-12-01",
    )
    assert body["name"] == "Website redesign"
    assert body["client_id"] == cid
    assert body["client_name"] == "Acme"
    assert body["status"] == "active"
    assert body["project_type"] == "fixed_price"
    assert body["currency"] == "USD"
    assert body["budget"] == 425000
    assert body["start_date"] == "2026-10-01"
    assert body["due_date"] == "2026-12-01"
    assert body["archived_at"] is None

    got = client.get(f"/api/projects/{body['id']}", headers=_auth(token))
    assert got.status_code == 200
    assert got.json()["client_name"] == "Acme"


def test_create_rejects_other_users_client(client):
    ava = _register(client, "ava@example.com")
    ben = _register(client, "ben@example.com")
    ava_client = _client_id(client, ava)
    res = client.post(
        "/api/projects",
        json=_project_payload(ava_client, project_type="hourly", currency="GBP"),
        headers=_auth(ben),
    )
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "client_not_found"


def test_create_rejects_nonexistent_client(client):
    token = _register(client, "ava@example.com")
    res = client.post(
        "/api/projects", json=_project_payload(999), headers=_auth(token)
    )
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "client_not_found"


def test_create_rejects_bad_enums(client):
    token = _register(client, "ava@example.com")
    cid = _client_id(client, token)
    for payload in (
        _project_payload(cid, project_type="nope"),
        _project_payload(cid, currency="EUR"),
        _project_payload(cid, status="archived"),
    ):
        res = client.post("/api/projects", json=payload, headers=_auth(token))
        assert res.status_code == 422, res.text
        assert res.json()["error"]["code"] == "validation_error"


def test_create_rejects_negative_money(client):
    token = _register(client, "ava@example.com")
    cid = _client_id(client, token)
    for field in ("budget", "hourly_rate", "fixed_price", "recurring_amount"):
        res = client.post(
            "/api/projects",
            json=_project_payload(cid, **{field: -1}),
            headers=_auth(token),
        )
        assert res.status_code == 422, (field, res.text)


def test_create_rejects_blank_name(client):
    token = _register(client, "ava@example.com")
    cid = _client_id(client, token)
    res = client.post(
        "/api/projects", json=_project_payload(cid, name="   "), headers=_auth(token)
    )
    assert res.status_code == 422


def test_blank_description_becomes_null(client):
    token = _register(client, "ava@example.com")
    cid = _client_id(client, token)
    body = _create_project(client, token, cid, description="  ", notes="")
    assert body["description"] is None
    assert body["notes"] is None


def test_list_excludes_archived_by_default(client):
    token = _register(client, "ava@example.com")
    cid = _client_id(client, token)
    live = _create_project(client, token, cid, name="Live")
    old = _create_project(client, token, cid, name="Old")
    archived = client.post(f"/api/projects/{old['id']}/archive", headers=_auth(token))
    assert archived.status_code == 200
    assert archived.json()["archived_at"] is not None

    listed = client.get("/api/projects", headers=_auth(token))
    assert [p["name"] for p in listed.json()] == ["Live"]

    all_projects = client.get("/api/projects?include_archived=true", headers=_auth(token))
    assert {p["name"] for p in all_projects.json()} == {"Live", "Old"}
    assert live["id"] != old["id"]


def test_archive_unarchive_roundtrip(client):
    token = _register(client, "ava@example.com")
    cid = _client_id(client, token)
    body = _create_project(client, token, cid)

    first = client.post(f"/api/projects/{body['id']}/archive", headers=_auth(token))
    assert first.status_code == 200
    assert first.json()["archived_at"] is not None

    # Idempotent: archiving twice keeps the original timestamp.
    second = client.post(f"/api/projects/{body['id']}/archive", headers=_auth(token))
    assert second.status_code == 200
    assert second.json()["archived_at"] == first.json()["archived_at"]

    unarchived = client.post(f"/api/projects/{body['id']}/unarchive", headers=_auth(token))
    assert unarchived.status_code == 200
    assert unarchived.json()["archived_at"] is None

    listed = client.get("/api/projects", headers=_auth(token))
    assert [p["id"] for p in listed.json()] == [body["id"]]


def test_update_persists(client):
    token = _register(client, "ava@example.com")
    cid = _client_id(client, token)
    body = _create_project(client, token, cid)
    res = client.patch(
        f"/api/projects/{body['id']}",
        json={"name": "Renamed", "status": "on_hold", "budget": 1000},
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text
    updated = res.json()
    assert updated["name"] == "Renamed"
    assert updated["status"] == "on_hold"
    assert updated["budget"] == 1000
    # Untouched fields survive a partial update.
    assert updated["project_type"] == "fixed_price"


def test_update_unknown_project_404(client):
    token = _register(client, "ava@example.com")
    res = client.patch("/api/projects/999", json={"name": "X"}, headers=_auth(token))
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "project_not_found"


def test_patch_explicit_null_rejected(client):
    token = _register(client, "ava@example.com")
    cid = _client_id(client, token)
    body = _create_project(client, token, cid)
    for field in ("name", "client_id", "project_type", "status", "currency"):
        res = client.patch(
            f"/api/projects/{body['id']}", json={field: None}, headers=_auth(token)
        )
        assert res.status_code == 422, field
        assert res.json()["error"]["code"] == "validation_error"
    # row untouched, no 500
    assert client.get(f"/api/projects/{body['id']}", headers=_auth(token)).status_code == 200


def test_delete_project(client):
    token = _register(client, "ava@example.com")
    cid = _client_id(client, token)
    body = _create_project(client, token, cid)
    deleted = client.delete(f"/api/projects/{body['id']}", headers=_auth(token))
    assert deleted.status_code == 204
    assert client.get(f"/api/projects/{body['id']}", headers=_auth(token)).status_code == 404


def test_client_delete_blocked_with_projects(client):
    token = _register(client, "ava@example.com")
    cid = _client_id(client, token)
    _create_project(client, token, cid)
    res = client.delete(f"/api/clients/{cid}", headers=_auth(token))
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "client_has_projects"
    # The client still exists.
    assert client.get(f"/api/clients/{cid}", headers=_auth(token)).status_code == 200


def test_client_detail_includes_projects(client):
    token = _register(client, "ava@example.com")
    cid = _client_id(client, token)
    body = _create_project(client, token, cid, name="Site")
    detail = client.get(f"/api/clients/{cid}", headers=_auth(token))
    assert detail.status_code == 200
    projects = detail.json()["projects"]
    assert [(p["id"], p["name"], p["status"]) for p in projects] == [
        (body["id"], "Site", "active")
    ]
    assert projects[0]["archived_at"] is None


def test_projects_are_isolated_per_user(client):
    ava = _register(client, "ava@example.com")
    ben = _register(client, "ben@example.com")
    cid = _client_id(client, ava)
    body = _create_project(client, ava, cid)

    assert client.get("/api/projects", headers=_auth(ben)).json() == []
    # No existence leak across users.
    assert client.get(f"/api/projects/{body['id']}", headers=_auth(ben)).status_code == 404
    assert (
        client.patch(
            f"/api/projects/{body['id']}", json={"name": "X"}, headers=_auth(ben)
        ).status_code
        == 404
    )
    assert client.delete(f"/api/projects/{body['id']}", headers=_auth(ben)).status_code == 404
    assert (
        client.post(
            f"/api/projects/{body['id']}/archive", headers=_auth(ben)
        ).status_code
        == 404
    )
