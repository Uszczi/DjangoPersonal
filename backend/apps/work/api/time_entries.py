from datetime import date as datetime_date
from typing import Any

from django.http import HttpRequest
from ninja import Router, Status

from apps.work import deps, handlers
from apps.work.contracts import (
    PatchedTimeEntryRequest,
    TimeEntry,
    TimeEntryCreateRequest,
)

router = Router(tags=['personal'])


@router.get(
    '/time-entries/',
    response=list[TimeEntry],
    operation_id='time_entries_list',
)
def list_time_entries(
    request: HttpRequest, task: int | None = None, date: datetime_date | None = None
) -> Any:
    handler = handlers.ListTimeEntries(deps.time_entry_repository())
    return handler.execute(task_id=task, day=date)


@router.post(
    '/time-entries/',
    response={201: TimeEntry},
    operation_id='time_entries_create',
)
def create_time_entry(request: HttpRequest, payload: TimeEntryCreateRequest) -> Any:
    handler = handlers.CreateTimeEntry(
        tasks=deps.task_repository(),
        time_entries=deps.time_entry_repository(),
    )
    return Status(201, handler.execute(payload))


@router.patch(
    '/time-entries/{id}/',
    response=TimeEntry,
    operation_id='time_entries_partial_update',
)
def update_time_entry(
    request: HttpRequest, id: int, payload: PatchedTimeEntryRequest
) -> Any:
    handler = handlers.UpdateTimeEntry(
        tasks=deps.task_repository(),
        time_entries=deps.time_entry_repository(),
    )
    return handler.execute(id, payload)


@router.delete(
    '/time-entries/{id}/',
    response={204: None},
    operation_id='time_entries_destroy',
)
def delete_time_entry(request: HttpRequest, id: int) -> Any:
    handlers.DeleteTimeEntry(deps.time_entry_repository()).execute(id)
    return Status(204, None)
