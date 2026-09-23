"""Phase 3: tasks scoped to the authenticated user and their project.

completed_at is managed server-side from status transitions: entering done
stamps it (if unset), leaving done clears it. The client never writes it.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..errors import coded_error
from ..models import Milestone, Project, Task, User
from ..schemas import TaskCreate, TaskOut, TaskUpdate

logger = logging.getLogger("knit.tasks")
router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _owned_project(db: Session, user_id: int, project_id: int) -> Project:
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user_id)
        .one_or_none()
    )
    if project is None:
        raise coded_error(404, "project_not_found", "project not found")
    return project


def _owned_task(db: Session, user_id: int, task_id: int) -> Task:
    task = (
        db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).one_or_none()
    )
    if task is None:
        raise coded_error(404, "task_not_found", "task not found")
    return task


def _checked_milestone(
    db: Session, user_id: int, project_id: int, milestone_id: int
) -> Milestone:
    """Milestones must exist, be owned, and belong to the task's project."""
    milestone = (
        db.query(Milestone)
        .filter(Milestone.id == milestone_id, Milestone.user_id == user_id)
        .one_or_none()
    )
    if milestone is None:
        raise coded_error(404, "milestone_not_found", "milestone not found")
    if milestone.project_id != project_id:
        raise coded_error(
            422,
            "task_milestone_mismatch",
            "milestone does not belong to this project",
        )
    return milestone


def _names(
    db: Session, user_id: int, tasks: list[Task]
) -> tuple[dict[int, str], dict[int, str]]:
    project_ids = {t.project_id for t in tasks}
    milestone_ids = {t.milestone_id for t in tasks if t.milestone_id is not None}
    projects = (
        db.query(Project).filter(Project.user_id == user_id, Project.id.in_(project_ids)).all()
        if project_ids
        else []
    )
    milestones = (
        db.query(Milestone)
        .filter(Milestone.user_id == user_id, Milestone.id.in_(milestone_ids))
        .all()
        if milestone_ids
        else []
    )
    return ({p.id: p.name for p in projects}, {m.id: m.name for m in milestones})


def _to_out(task: Task, project_name: str, milestone_name: str | None) -> dict[str, Any]:
    return {
        "id": task.id,
        "user_id": task.user_id,
        "project_id": task.project_id,
        "milestone_id": task.milestone_id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "due_date": task.due_date,
        "estimated_duration_seconds": task.estimated_duration_seconds,
        "completed_at": task.completed_at,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "project_name": project_name,
        "milestone_name": milestone_name,
    }


@router.get("/projects/{project_id}/tasks", response_model=list[TaskOut])
def list_project_tasks(
    project_id: int,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    _owned_project(db, user.id, project_id)
    tasks = (
        db.query(Task)
        .filter(Task.user_id == user.id, Task.project_id == project_id)
        .order_by(Task.id)
        .all()
    )
    project_names, milestone_names = _names(db, user.id, tasks)
    return [
        _to_out(
            t,
            project_names.get(t.project_id, ""),
            milestone_names.get(t.milestone_id) if t.milestone_id is not None else None,
        )
        for t in tasks
    ]


@router.post("/projects/{project_id}/tasks", response_model=TaskOut, status_code=201)
def create_task(
    project_id: int,
    body: TaskCreate,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    project = _owned_project(db, user.id, project_id)
    data = body.model_dump(mode="json")
    milestone_name: str | None = None
    if data.get("milestone_id") is not None:
        milestone = _checked_milestone(db, user.id, project_id, data["milestone_id"])
        milestone_name = milestone.name
    task = Task(
        user_id=user.id,
        project_id=project_id,
        **data,
        completed_at=_now() if data.get("status") == "done" else None,
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    logger.info(
        "task_create resource=task identifier=%s user=%s project=%s",
        task.id,
        user.id,
        project_id,
    )
    return _to_out(task, project.name, milestone_name)


@router.get("/tasks", response_model=list[TaskOut])
def list_all_tasks(
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    tasks = db.query(Task).filter(Task.user_id == user.id).order_by(Task.id).all()
    project_names, milestone_names = _names(db, user.id, tasks)
    return [
        _to_out(
            t,
            project_names.get(t.project_id, ""),
            milestone_names.get(t.milestone_id) if t.milestone_id is not None else None,
        )
        for t in tasks
    ]


@router.get("/tasks/{task_id}", response_model=TaskOut)
def get_task(
    task_id: int,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    task = _owned_task(db, user.id, task_id)
    project_names, milestone_names = _names(db, user.id, [task])
    return _to_out(
        task,
        project_names.get(task.project_id, ""),
        milestone_names.get(task.milestone_id) if task.milestone_id is not None else None,
    )


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    body: TaskUpdate,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    task = _owned_task(db, user.id, task_id)
    old_status = task.status
    data = body.model_dump(mode="json", exclude_unset=True)
    if "milestone_id" in data and data["milestone_id"] is not None:
        _checked_milestone(db, user.id, task.project_id, data["milestone_id"])
    for field, value in data.items():
        setattr(task, field, value)
    new_status = task.status
    if new_status == "done" and old_status != "done":
        if task.completed_at is None:
            task.completed_at = _now()
    elif new_status != "done" and old_status == "done":
        task.completed_at = None
    task.updated_at = _now()
    db.commit()
    db.refresh(task)
    logger.info("task_update resource=task identifier=%s user=%s", task.id, user.id)
    project_names, milestone_names = _names(db, user.id, [task])
    return _to_out(
        task,
        project_names.get(task.project_id, ""),
        milestone_names.get(task.milestone_id) if task.milestone_id is not None else None,
    )


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    task = _owned_task(db, user.id, task_id)
    db.delete(task)
    db.commit()
    logger.info("task_delete resource=task identifier=%s user=%s", task_id, user.id)
    return Response(status_code=204)
