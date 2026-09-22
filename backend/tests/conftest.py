"""Isolated test wiring: temp SQLite file per test, no dev-data pollution."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import settings
from app.database import create_engine_for, get_db
from app.main import create_app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = str(tmp_path / "test.db")
    monkeypatch.setattr(settings, "database_path", db_path, raising=False)
    engine = create_engine_for(db_path)
    from sqlalchemy.orm import sessionmaker

    TestingSessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_db():
        db: Session = TestingSessions()
        try:
            yield db
        finally:
            db.close()

    app = create_app()
    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as c:
        yield c
    engine.dispose()
