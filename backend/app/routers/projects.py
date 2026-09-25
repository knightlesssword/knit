"""Phase 2: project CRUD scoped to the authenticated user.

Money is integer minor units end to end; dates cross the API as ISO dates
but persist as YYYY-MM-DD text. Archive is a timestamp, not deletion.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Response
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..errors import coded_error
from ..models import Client, Milestone, Project, Task, TimeEntry, User
from ..schemas import ProjectCreate, ProjectOut, ProjectUpdate

logger = logging.getLogger("knit.projects")
router = APIRouter(prefix="/projects")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _owned_client(db: Session, user_id: int, client_id: int) -> Client:
    client = (
        db.query(Client).filter(Client.id == client_id, Client.user_id == user_id).one_or_none()
    )
    if client is None:
        raise coded_error(404, "client_not_found", "client not found")
    return client


def _owned_project(db: Session, user_id: int, project_id: int) -> Project:
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user_id)
        .one_or_none()
    )
    if project is None:
        raise coded_error(404, "project_not_found", "project not found")
    return project


def _client_name(db: Session, user_id: int, client_id: int) -> str:
    return _owned_client(db, user_id, client_id).name


def _progress(db: Session, user_id: int, project_id: int) -> dict[str, int] | None:
    """completed tasks / total tasks; null when the project has no tasks."""
    total = (
        db.query(func.count(Task.id))
        .filter(Task.user_id == user_id, Task.project_id == project_id)
        .scalar()
        or 0
    )
    if total == 0:
        return None
    done = (
        db.query(func.count(Task.id))
        .filter(
            Task.user_id == user_id,
            Task.project_id == project_id,
            Task.status == "done",
        )
        .scalar()
        or 0
    )
    return {"total": total, "done": done}


def _to_out(
    project: Project, client_name: str, progress: dict[str, int] | None = None
) -> dict[str, Any]:
    return {
        "id": project.id,
        "user_id": project.user_id,
        "client_id": project.client_id,
        "client_name": client_name,
        "name": project.name,
        "description": project.description,
        "notes": project.notes,
        "project_type": project.project_type,
        "status": project.status,
        "currency": project.currency,
        "budget": project.budget,
        "hourly_rate": project.hourly_rate,
        "fixed_price": project.fixed_price,
        "recurring_amount": project.recurring_amount,
        "recurring_billing_period": project.recurring_billing_period,
        # Stored as YYYY-MM-DD text; pydantic parses ISO strings into dates.
        "start_date": project.start_date,
        "due_date": project.due_date,
        "archived_at": project.archived_at,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "progress": progress,
    }


@router.get("", response_model=list[ProjectOut])
def list_projects(
    include_archived: bool = False,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    query = (
        db.query(Project, Client.name)
        .join(Client, Client.id == Project.client_id)
        .filter(Project.user_id == user.id, Client.user_id == user.id)
    )
    if not include_archived:
        query = query.filter(Project.archived_at.is_(None))
    rows = query.order_by(Project.id).all()
    # One COUNT pair per project; local scale, no caching layer.
    return [
        _to_out(project, name, _progress(db, user.id, project.id))
        for project, name in rows
    ]


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    body: ProjectCreate,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    client = _owned_client(db, user.id, body.client_id)
    # mode="json" serializes dates to YYYY-MM-DD strings for TEXT storage.
    project = Project(
        user_id=user.id, **body.model_dump(mode="json"), created_at=_now(), updated_at=_now()
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    logger.info(
        "project_create resource=project identifier=%s user=%s client=%s",
        project.id,
        user.id,
        client.id,
    )
    # Fresh projects have no tasks, so progress is null without a query.
    return _to_out(project, client.name, None)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    project = _owned_project(db, user.id, project_id)
    return _to_out(
        project,
        _client_name(db, user.id, project.client_id),
        _progress(db, user.id, project.id),
    )


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    body: ProjectUpdate,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    project = _owned_project(db, user.id, project_id)
    data = body.model_dump(mode="json", exclude_unset=True)
    if "client_id" in data:
        # Re-verify ownership: no moving projects onto another user's client.
        _owned_client(db, user.id, data["client_id"])
    for field, value in data.items():
        setattr(project, field, value)
    project.updated_at = _now()
    db.commit()
    db.refresh(project)
    logger.info("project_update resource=project identifier=%s user=%s", project.id, user.id)
    return _to_out(
        project,
        _client_name(db, user.id, project.client_id),
        _progress(db, user.id, project.id),
    )


@router.post("/{project_id}/archive", response_model=ProjectOut)
def archive_project(
    project_id: int,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    project = _owned_project(db, user.id, project_id)
    if project.archived_at is None:
        project.archived_at = _now()
        project.updated_at = project.archived_at
        db.commit()
        db.refresh(project)
    logger.info("project_archive resource=project identifier=%s user=%s", project.id, user.id)
    return _to_out(
        project,
        _client_name(db, user.id, project.client_id),
        _progress(db, user.id, project.id),
    )


@router.post("/{project_id}/unarchive", response_model=ProjectOut)
def unarchive_project(
    project_id: int,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    project = _owned_project(db, user.id, project_id)
    if project.archived_at is not None:
        project.archived_at = None
        project.updated_at = _now()
        db.commit()
        db.refresh(project)
    logger.info("project_unarchive resource=project identifier=%s user=%s", project.id, user.id)
    return _to_out(
        project,
        _client_name(db, user.id, project.client_id),
        _progress(db, user.id, project.id),
    )


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    project = _owned_project(db, user.id, project_id)
    has_work = (
        db.query(Milestone.id)
        .filter(Milestone.user_id == user.id, Milestone.project_id == project.id)
        .first()
        is not None
        or db.query(Task.id)
        .filter(Task.user_id == user.id, Task.project_id == project.id)
        .first()
        is not None
        or db.query(TimeEntry.id)
        .filter(TimeEntry.user_id == user.id, TimeEntry.project_id == project.id)
        .first()
        is not None
    )
    if has_work:
        raise coded_error(
            409,
            "project_has_work",
            "project has milestones, tasks, or time entries and cannot be "
            "deleted; archive it instead",
        )
    try:
        db.delete(project)
        db.commit()
    except IntegrityError:
        # Dependent row appeared between guard and commit: same answer, no 500.
        db.rollback()
        raise coded_error(
            409,
            "project_has_work",
            "project has milestones, tasks, or time entries and cannot be "
            "deleted; archive it instead",
        ) from None
    logger.info("project_delete resource=project identifier=%s user=%s", project_id, user.id)
    return Response(status_code=204)
