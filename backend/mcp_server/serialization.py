"""Shape use-case results as JSON-ready dicts, through the API's response contracts."""

from collections.abc import Iterable
from datetime import date as date_type
from datetime import datetime
from typing import Any

from apps.infra.models import Project, Task, TimeEntry
from apps.work.contracts import (
    ProjectResponse,
    TaskResponse,
    TimeEntryResponse,
    TimerResponse,
)


def project(obj: Project) -> dict[str, Any]:
    return ProjectResponse.model_validate(obj).model_dump(mode='json')


def projects(objs: Iterable[Project]) -> list[dict[str, Any]]:
    return [project(o) for o in objs]


def task(obj: Task) -> dict[str, Any]:
    return TaskResponse.model_validate(obj).model_dump(mode='json')


def tasks(objs: Iterable[Task]) -> list[dict[str, Any]]:
    return [task(o) for o in objs]


def time_entry(obj: TimeEntry) -> dict[str, Any]:
    return TimeEntryResponse.model_validate(obj).model_dump(mode='json')


def time_entries(objs: Iterable[TimeEntry]) -> list[dict[str, Any]]:
    return [time_entry(o) for o in objs]


def timer(entry: TimeEntry | None, server_now: datetime) -> dict[str, Any]:
    state = TimerResponse(
        entry=None if entry is None else TimeEntryResponse.model_validate(entry),
        server_now=server_now,
    )
    return state.model_dump(mode='json')


def parse_date(value: str | None) -> date_type | None:
    if value is None:
        return None
    return date_type.fromisoformat(value)
