from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..errors import coded_error
from ..models import Client, Project, User
from ..schemas import ClientCreate, ClientOut, ClientUpdate

logger = logging.getLogger("knit.clients")
router = APIRouter(prefix="/clients")


def _owned(db: Session, user_id: int, client_id: int) -> Client:
    client = (
        db.query(Client).filter(Client.id == client_id, Client.user_id == user_id).one_or_none()
    )
    if client is None:
        raise HTTPException(status_code=404, detail="client not found")
    return client


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _project_summary(project: Project) -> dict[str, Any]:
    return {
        "id": project.id,
        "name": project.name,
        "status": project.status,
        "archived_at": project.archived_at,
    }


def _to_out(client: Client, projects: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "id": client.id,
        "name": client.name,
        "company": client.company,
        "email": client.email,
        "phone": client.phone,
        "notes": client.notes,
        "created_at": client.created_at,
        "updated_at": client.updated_at,
        "projects": projects,
    }


def _projects_for(db: Session, user_id: int, client_id: int) -> list[dict[str, Any]]:
    rows = (
        db.query(Project)
        .filter(Project.user_id == user_id, Project.client_id == client_id)
        .order_by(Project.id)
        .all()
    )
    return [_project_summary(p) for p in rows]


@router.get("", response_model=list[ClientOut])
def list_clients(user: User = Depends(get_current_user), db: Session = Depends(get_db)):  # noqa: B008
    clients = db.query(Client).filter(Client.user_id == user.id).order_by(Client.id).all()
    rows = (
        db.query(Project)
        .filter(Project.user_id == user.id)
        .order_by(Project.id)
        .all()
    )
    by_client: dict[int, list[dict[str, Any]]] = {}
    for project in rows:
        by_client.setdefault(project.client_id, []).append(_project_summary(project))
    return [_to_out(client, by_client.get(client.id, [])) for client in clients]


@router.post("", response_model=ClientOut, status_code=201)
def create_client(
    body: ClientCreate,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    client = Client(user_id=user.id, **body.model_dump(), created_at=_now(), updated_at=_now())
    db.add(client)
    db.commit()
    db.refresh(client)
    logger.info("client_create resource=client identifier=%s user=%s", client.id, user.id)
    return _to_out(client, [])


@router.get("/{client_id}", response_model=ClientOut)
def get_client(
    client_id: int,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    client = _owned(db, user.id, client_id)
    return _to_out(client, _projects_for(db, user.id, client.id))


@router.patch("/{client_id}", response_model=ClientOut)
def update_client(
    client_id: int,
    body: ClientUpdate,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    client = _owned(db, user.id, client_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    client.updated_at = _now()
    db.commit()
    db.refresh(client)
    logger.info("client_update resource=client identifier=%s user=%s", client.id, user.id)
    return _to_out(client, _projects_for(db, user.id, client.id))


@router.delete("/{client_id}", status_code=204)
def delete_client(
    client_id: int,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    client = _owned(db, user.id, client_id)
    has_projects = (
        db.query(Project.id)
        .filter(Project.user_id == user.id, Project.client_id == client.id)
        .first()
        is not None
    )
    if has_projects:
        raise coded_error(
            409, "client_has_projects", "client has projects and cannot be deleted"
        )
    db.delete(client)
    db.commit()
    logger.info("client_delete resource=client identifier=%s user=%s", client_id, user.id)
    return Response(status_code=204)
