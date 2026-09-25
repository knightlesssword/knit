"""Phase 1: client CRUD scoped to the authenticated user."""
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


def test_clients_require_auth(client):
    assert client.get("/api/clients").status_code == 401
    assert client.post("/api/clients", json={"name": "Acme"}).status_code == 401


def test_create_and_list_client(client):
    token = _register(client, "ava@example.com")
    created = client.post(
        "/api/clients",
        json={"name": "Acme Inc.", "company": "Acme", "email": "hi@acme.test"},
        headers=_auth(token),
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["name"] == "Acme Inc."
    assert body["company"] == "Acme"
    assert body["phone"] is None

    listed = client.get("/api/clients", headers=_auth(token))
    assert listed.status_code == 200
    assert [c["name"] for c in listed.json()] == ["Acme Inc."]


def test_create_rejects_blank_name(client):
    token = _register(client, "ava@example.com")
    res = client.post("/api/clients", json={"name": "   "}, headers=_auth(token))
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"


def test_create_rejects_bad_email(client):
    token = _register(client, "ava@example.com")
    res = client.post(
        "/api/clients", json={"name": "Acme", "email": "nope"}, headers=_auth(token)
    )
    assert res.status_code == 422


def test_blank_optionals_become_null(client):
    token = _register(client, "ava@example.com")
    res = client.post(
        "/api/clients",
        json={"name": "Acme", "company": "  ", "email": ""},
        headers=_auth(token),
    )
    assert res.status_code == 201, res.text
    assert res.json()["company"] is None
    assert res.json()["email"] is None


def test_clients_are_isolated_per_user(client):
    ava = _register(client, "ava@example.com")
    ben = _register(client, "ben@example.com")
    client.post("/api/clients", json={"name": "Ava Client"}, headers=_auth(ava))

    assert [c["name"] for c in client.get("/api/clients", headers=_auth(ben)).json()] == []

    ava_id = client.get("/api/clients", headers=_auth(ava)).json()[0]["id"]
    # ben cannot read, edit, or delete ava's client: 404, no existence leak
    assert client.get(f"/api/clients/{ava_id}", headers=_auth(ben)).status_code == 404
    assert (
        client.patch(f"/api/clients/{ava_id}", json={"name": "X"}, headers=_auth(ben)).status_code
        == 404
    )
    assert client.delete(f"/api/clients/{ava_id}", headers=_auth(ben)).status_code == 404


def test_get_update_delete_flow(client):
    token = _register(client, "ava@example.com")
    created = client.post("/api/clients", json={"name": "Acme"}, headers=_auth(token)).json()

    got = client.get(f"/api/clients/{created['id']}", headers=_auth(token))
    assert got.status_code == 200
    assert got.json()["name"] == "Acme"

    patched = client.patch(
        f"/api/clients/{created['id']}",
        json={"name": "Acme Ltd", "phone": "+1 555"},
        headers=_auth(token),
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["name"] == "Acme Ltd"
    assert patched.json()["phone"] == "+1 555"

    deleted = client.delete(f"/api/clients/{created['id']}", headers=_auth(token))
    assert deleted.status_code == 204
    assert client.get(f"/api/clients/{created['id']}", headers=_auth(token)).status_code == 404


def test_update_unknown_client_404(client):
    token = _register(client, "ava@example.com")
    res = client.patch("/api/clients/999", json={"name": "X"}, headers=_auth(token))
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "client_not_found"


def test_patch_explicit_null_rejected(client):
    token = _register(client, "ava@example.com")
    created = client.post("/api/clients", json={"name": "Acme"}, headers=_auth(token)).json()
    res = client.patch(
        f"/api/clients/{created['id']}", json={"name": None}, headers=_auth(token)
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"
    # row untouched, no 500
    assert client.get(f"/api/clients/{created['id']}", headers=_auth(token)).json()["name"] == "Acme"
