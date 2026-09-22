"""Auth foundation: register, login, me, hashing, error shapes."""
from __future__ import annotations

import sqlite3

from app.config import settings


def _register(client, name="Ava", email="ava@example.com", password="password123"):
    return client.post(
        "/api/auth/register", json={"name": name, "email": email, "password": password}
    )


def test_register_and_login_flow(client):
    reg = _register(client)
    assert reg.status_code == 201, reg.text
    body = reg.json()
    assert body["user"]["email"] == "ava@example.com"
    assert "password" not in body["user"]
    assert body["token"]

    login = client.post(
        "/api/auth/login", json={"identifier": "ava@example.com", "password": "password123"}
    )
    assert login.status_code == 200, login.text

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {login.json()['token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "ava@example.com"


def test_register_duplicate_email_conflict(client):
    assert _register(client).status_code == 201
    dup = _register(client)
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "user_exists"


def test_register_duplicate_email_case_insensitive(client):
    assert _register(client, email="Ava@Example.com").status_code == 201
    dup = _register(client, email="ava@example.com")
    assert dup.status_code == 409


def test_register_validation(client):
    short = _register(client, password="short")
    assert short.status_code == 422
    assert short.json()["error"]["code"] == "validation_error"
    bad_email = _register(client, email="not-an-email")
    assert bad_email.status_code == 422


def test_login_wrong_password(client):
    assert _register(client).status_code == 201
    bad = client.post(
        "/api/auth/login", json={"identifier": "ava@example.com", "password": "wrongpass1"}
    )
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "invalid_credentials"


def test_login_unknown_user(client):
    res = client.post(
        "/api/auth/login", json={"identifier": "nobody@example.com", "password": "password123"}
    )
    assert res.status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401
    bad = client.get("/api/auth/me", headers={"Authorization": "Bearer junk"})
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "unauthorized"


def test_password_is_hashed_not_plaintext(client):
    assert _register(client).status_code == 201
    conn = sqlite3.connect(settings.database_path)
    try:
        row = conn.execute("SELECT password_hash FROM users").fetchone()
    finally:
        conn.close()
    assert row is not None
    assert row[0] != "password123"
    assert row[0].startswith("$2b$")
