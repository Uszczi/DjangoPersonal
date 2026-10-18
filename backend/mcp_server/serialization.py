"""Helpers to convert Django ORM objects into MCP-friendly dicts."""

from datetime import date as date_type
from typing import Any

from apps.work.contracts import (
    ProjectResponse,
    TaskResponse,
    TimeEntryResponse,
    TimerResponse,
)


def project(obj: Any) -> dict[str, Any]:
    return ProjectResponse.model_validate(obj).model_dump(mode="json")


def projects(qs: Any) -> list[dict[str, Any]]:
    return [project(o) for o in qs]


def task(obj: Any) -> dict[str, Any]:
    return TaskResponse.model_validate(obj).model_dump(mode="json")


def tasks(qs: Any) -> list[dict[str, Any]]:
    return [task(o) for o in qs]


def time_entry(obj: Any) -> dict[str, Any]:
    return TimeEntryResponse.model_validate(obj).model_dump(mode="json")


def time_entries(qs: Any) -> list[dict[str, Any]]:
    return [time_entry(o) for o in qs]


def timer(entry: Any, server_now: Any) -> dict[str, Any]:
    return TimerResponse(entry=entry, server_now=server_now).model_dump(mode="json")


def parse_date(value: str | None) -> Any:
    if value is None:
        return None
    return date_type.fromisoformat(value)