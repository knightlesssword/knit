"""Phase 4: time entries scoped to the authenticated user and their project.

Durations are integer seconds end to end, never timestamps or floats.
entry_date crosses the API as an ISO date but persists as YYYY-MM-DD text.
The optional task link must belong to the same project as the entry.

Timesheet sums stay in integer arithmetic: SQL SUM over integer seconds, or
plain Python int addition. No float anywhere near durations.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..errors import coded_error
from ..models import Project, Task, TimeEntry, User
from ..schemas import TimeEntryCreate, TimeEntryOut, TimeEntryUpdate, WeekSummaryOut

logger = logging.getLogger("knit.time")
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


def _owned_entry(db: Session, user_id: int, entry_id: int) -> TimeEntry:
    entry = (
        db.query(TimeEntry)
        .filter(TimeEntry.id == entry_id, TimeEntry.user_id == user_id)
        .one_or_none()
    )
    if entry is None:
        raise coded_error(404, "time_entry_not_found", "time entry not found")
    return entry


def _checked_task(db: Session, user_id: int, project_id: int, task_id: int) -> Task:
    """Tasks must exist, be owned, and belong to the entry's project."""
    task = (
        db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).one_or_none()
    )
    if task is None:
        raise coded_error(404, "task_not_found", "task not found")
    if task.project_id != project_id:
        raise coded_error(
            422,
            "entry_task_mismatch",
            "task does not belong to this project",
        )
    return task


def _names(
    db: Session, user_id: int, entries: list[TimeEntry]
) -> tuple[dict[int, str], dict[int, str]]:
    project_ids = {e.project_id for e in entries}
    task_ids = {e.task_id for e in entries if e.task_id is not None}
    projects = (
        db.query(Project).filter(Project.user_id == user_id, Project.id.in_(project_ids)).all()
        if project_ids
        else []
    )
    tasks = (
        db.query(Task).filter(Task.user_id == user_id, Task.id.in_(task_ids)).all()
        if task_ids
        else []
    )
    return ({p.id: p.name for p in projects}, {t.id: t.title for t in tasks})


def _to_out(
    entry: TimeEntry, project_name: str, task_title: str | None
) -> dict[str, Any]:
    return {
        "id": entry.id,
        "user_id": entry.user_id,
        "project_id": entry.project_id,
        "task_id": entry.task_id,
        "entry_date": entry.entry_date,
        "duration_seconds": entry.duration_seconds,
        "description": entry.description,
        "billable": bool(entry.billable),
        "created_at": entry.created_at,
        "updated_at": entry.updated_at,
        "project_name": project_name,
        "task_title": task_title,
    }


@router.get("/projects/{project_id}/time-entries", response_model=list[TimeEntryOut])
def list_project_entries(
    project_id: int,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    project = _owned_project(db, user.id, project_id)
    entries = (
        db.query(TimeEntry)
        .filter(TimeEntry.user_id == user.id, TimeEntry.project_id == project_id)
        .order_by(TimeEntry.entry_date, TimeEntry.id)
        .all()
    )
    _, task_titles = _names(db, user.id, entries)
    return [
        _to_out(
            e,
            project.name,
            task_titles.get(e.task_id) if e.task_id is not None else None,
        )
        for e in entries
    ]


@router.post(
    "/projects/{project_id}/time-entries", response_model=TimeEntryOut, status_code=201
)
def create_entry(
    project_id: int,
    body: TimeEntryCreate,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    project = _owned_project(db, user.id, project_id)
    data = body.model_dump(mode="json")
    task_title: str | None = None
    if data.get("task_id") is not None:
        task_title = _checked_task(db, user.id, project_id, data["task_id"]).title
    entry = TimeEntry(
        user_id=user.id,
        project_id=project_id,
        task_id=data.get("task_id"),
        entry_date=data["entry_date"],
        duration_seconds=data["duration_seconds"],
        description=data.get("description"),
        billable=1 if data.get("billable", True) else 0,
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    logger.info(
        "time_entry_create resource=time_entry identifier=%s user=%s project=%s",
        entry.id,
        user.id,
        project_id,
    )
    return _to_out(entry, project.name, task_title)


@router.get("/time-entries", response_model=list[TimeEntryOut])
def list_entries(
    project_id: int | None = None,
    task_id: int | None = None,
    billable: bool | None = None,
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    # Unknown or foreign ids are 404, never silently empty.
    if project_id is not None:
        _owned_project(db, user.id, project_id)
    if task_id is not None:
        task = (
            db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).one_or_none()
        )
        if task is None:
            raise coded_error(404, "task_not_found", "task not found")
    query = db.query(TimeEntry).filter(TimeEntry.user_id == user.id)
    if project_id is not None:
        query = query.filter(TimeEntry.project_id == project_id)
    if task_id is not None:
        query = query.filter(TimeEntry.task_id == task_id)
    if billable is not None:
        query = query.filter(TimeEntry.billable == (1 if billable else 0))
    if from_date is not None:
        query = query.filter(TimeEntry.entry_date >= from_date.isoformat())
    if to_date is not None:
        query = query.filter(TimeEntry.entry_date <= to_date.isoformat())
    entries = query.order_by(TimeEntry.entry_date, TimeEntry.id).all()
    project_names, task_titles = _names(db, user.id, entries)
    return [
        _to_out(
            e,
            project_names.get(e.project_id, ""),
            task_titles.get(e.task_id) if e.task_id is not None else None,
        )
        for e in entries
    ]


@router.get("/timesheet", response_model=WeekSummaryOut)
def week_summary(
    week_start: date = Query(alias="week_start"),
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    # Any date in the week is accepted; the server snaps back to Monday.
    monday = week_start - timedelta(days=week_start.weekday())
    days = [monday + timedelta(days=i) for i in range(7)]
    start, end = days[0].isoformat(), days[6].isoformat()
    entries = (
        db.query(TimeEntry)
        .filter(
            TimeEntry.user_id == user.id,
            TimeEntry.entry_date >= start,
            TimeEntry.entry_date <= end,
        )
        .all()
    )
    # Integer sums only; missing days stay zero.
    by_day: dict[str, dict[str, int]] = {
        d.isoformat(): {"total": 0, "billable": 0} for d in days
    }
    by_project_id: dict[int, int] = {}
    for entry in entries:
        bucket = by_day.get(entry.entry_date)
        if bucket is None:  # pragma: no cover - range filter guarantees membership
            continue
        bucket["total"] += entry.duration_seconds
        if entry.billable:
            bucket["billable"] += entry.duration_seconds
        by_project_id[entry.project_id] = (
            by_project_id.get(entry.project_id, 0) + entry.duration_seconds
        )
    project_names: dict[int, str] = {}
    if by_project_id:
        for project in (
            db.query(Project)
            .filter(Project.user_id == user.id, Project.id.in_(by_project_id))
            .all()
        ):
            project_names[project.id] = project.name
    day_out = [
        {
            "date": d.isoformat(),
            "total_seconds": by_day[d.isoformat()]["total"],
            "billable_seconds": by_day[d.isoformat()]["billable"],
            "non_billable_seconds": by_day[d.isoformat()]["total"]
            - by_day[d.isoformat()]["billable"],
        }
        for d in days
    ]
    week_total = sum(d["total_seconds"] for d in day_out)
    week_billable = sum(d["billable_seconds"] for d in day_out)
    return {
        "week_start": monday.isoformat(),
        "days": day_out,
        "week_total_seconds": week_total,
        "week_billable_seconds": week_billable,
        "week_non_billable_seconds": week_total - week_billable,
        "by_project": [
            {
                "project_id": pid,
                "project_name": project_names.get(pid, ""),
                "total_seconds": total,
            }
            for pid, total in sorted(by_project_id.items())
        ],
    }


@router.get("/time-entries/{entry_id}", response_model=TimeEntryOut)
def get_entry(
    entry_id: int,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    entry = _owned_entry(db, user.id, entry_id)
    project_names, task_titles = _names(db, user.id, [entry])
    return _to_out(
        entry,
        project_names.get(entry.project_id, ""),
        task_titles.get(entry.task_id) if entry.task_id is not None else None,
    )


@router.patch("/time-entries/{entry_id}", response_model=TimeEntryOut)
def update_entry(
    entry_id: int,
    body: TimeEntryUpdate,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    entry = _owned_entry(db, user.id, entry_id)
    data = body.model_dump(mode="json", exclude_unset=True)
    if "task_id" in data:
        if data["task_id"] is not None:
            _checked_task(db, user.id, entry.project_id, data["task_id"])
        entry.task_id = data["task_id"]
    if "entry_date" in data and data["entry_date"] is not None:
        entry.entry_date = data["entry_date"]
    if "duration_seconds" in data and data["duration_seconds"] is not None:
        entry.duration_seconds = data["duration_seconds"]
    if "description" in data:
        entry.description = data["description"]
    if "billable" in data and data["billable"] is not None:
        entry.billable = 1 if data["billable"] else 0
    entry.updated_at = _now()
    db.commit()
    db.refresh(entry)
    logger.info(
        "time_entry_update resource=time_entry identifier=%s user=%s", entry.id, user.id
    )
    project_names, task_titles = _names(db, user.id, [entry])
    return _to_out(
        entry,
        project_names.get(entry.project_id, ""),
        task_titles.get(entry.task_id) if entry.task_id is not None else None,
    )


@router.delete("/time-entries/{entry_id}", status_code=204)
def delete_entry(
    entry_id: int,
    user: User = Depends(get_current_user),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    entry = _owned_entry(db, user.id, entry_id)
    db.delete(entry)
    db.commit()
    logger.info(
        "time_entry_delete resource=time_entry identifier=%s user=%s", entry_id, user.id
    )
    return Response(status_code=204)
