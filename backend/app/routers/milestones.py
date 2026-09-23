"""Phase 3: milestones scoped to the authenticated user and their project.

Milestone deletion is allowed: dependent tasks keep existing with
milestone_id SET NULL by the database foreign key.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Response
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..errors import coded_error
from ..models import Milestone, Project, Task, User
from ..schemas import MilestoneCreate, MilestoneOut, MilestoneUpdate

logger = logging.getLogger("knit.milestones")
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


def _owned_milestone(db: Session, user_id: int, milestone_id: int) -> Milestone:
    milestone = (
        db.query(Milestone)
        .filter(Milestone.id == milestone_id, Milestone.user_id == user_id)
        .one_or_none()
    )
    if milestone is None:
        raise coded_error(404, "milestone_not_found", "milestone not found")
    return milestone


def _counts(db: Session, user_id: int, milestone_id: int) -> tuple[int, int]:
    total = (
        db.query(func.count(Task.id))
        .filter(Task.user_id == user_id, Task.milestone_id == milestone_id)
        .scalar()
        or 0
    )
    done = (
        db.query(func.count(Task.id))
        .filter(
            Task.user_id == user_id,
            Task.milestone_id == milestone_id,
            Task.status == "done",
        )
        .scalar()
        or 0
    )
    return total, done


def _to_out(milestone: Milestone, task_total: int, task_done: int) -> dict[str, Any]:
    return {
        "id": milestone.id,
        "user_id": milestone.user_id,
        "project_id": milestone.project_id,
        "name": milestone.name,
        "description": milestone.description,
        "due_date": milestone.due_date,
        "status": milestone.status,
        "position": milestone.position,
        "created_at": milestone.created_at,
        "updated_at": milestone.updated_at,
        "task_total": task_total,
        "task_done": task_done,
    }


@router.get("/projects/{project_id}/milestones", response_model=list[MilestoneOut])
def list_milestones(
    project_id: int,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    _owned_project(db, user.id, project_id)
    milestones = (
        db.query(Milestone)
        .filter(Milestone.user_id == user.id, Milestone.project_id == project_id)
        .order_by(Milestone.position, Milestone.id)
        .all()
    )
    # One grouped count query for the whole project; local scale, no caching layer.
    grouped = (
        db.query(
            Task.milestone_id,
            func.count(Task.id),
            func.sum(case((Task.status == "done", 1), else_=0)),
        )
        .filter(Task.user_id == user.id, Task.project_id == project_id)
        .group_by(Task.milestone_id)
        .all()
    )
    totals: dict[int | None, tuple[int, int]] = {
        mid: (total, int(done or 0)) for mid, total, done in grouped if mid is not None
    }
    return [
        _to_out(m, *totals.get(m.id, (0, 0)))
        for m in milestones
    ]


@router.post("/projects/{project_id}/milestones", response_model=MilestoneOut, status_code=201)
def create_milestone(
    project_id: int,
    body: MilestoneCreate,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    _owned_project(db, user.id, project_id)
    milestone = Milestone(
        user_id=user.id,
        project_id=project_id,
        **body.model_dump(mode="json"),
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    logger.info(
        "milestone_create resource=milestone identifier=%s user=%s project=%s",
        milestone.id,
        user.id,
        project_id,
    )
    return _to_out(milestone, 0, 0)


@router.get("/milestones/{milestone_id}", response_model=MilestoneOut)
def get_milestone(
    milestone_id: int,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    milestone = _owned_milestone(db, user.id, milestone_id)
    total, done = _counts(db, user.id, milestone.id)
    return _to_out(milestone, total, done)


@router.patch("/milestones/{milestone_id}", response_model=MilestoneOut)
def update_milestone(
    milestone_id: int,
    body: MilestoneUpdate,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    milestone = _owned_milestone(db, user.id, milestone_id)
    for field, value in body.model_dump(mode="json", exclude_unset=True).items():
        setattr(milestone, field, value)
    milestone.updated_at = _now()
    db.commit()
    db.refresh(milestone)
    logger.info(
        "milestone_update resource=milestone identifier=%s user=%s", milestone.id, user.id
    )
    total, done = _counts(db, user.id, milestone.id)
    return _to_out(milestone, total, done)


@router.delete("/milestones/{milestone_id}", status_code=204)
def delete_milestone(
    milestone_id: int,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    milestone = _owned_milestone(db, user.id, milestone_id)
    db.delete(milestone)
    db.commit()
    # Dependent tasks keep existing; the FK sets their milestone_id to NULL.
    logger.info(
        "milestone_delete resource=milestone identifier=%s user=%s tasks_nullified",
        milestone_id,
        user.id,
    )
    return Response(status_code=204)
