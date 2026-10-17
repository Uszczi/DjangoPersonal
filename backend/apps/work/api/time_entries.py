from datetime import date as datetime_date

from ninja import Router, Status

from apps.work import handlers
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
def list_time_entries(request, task: int = None, date: datetime_date = None):
    return handlers.list_time_entries(task_id=task, day=date)


@router.post(
    '/time-entries/',
    response={201: TimeEntry},
    operation_id='time_entries_create',
)
def create_time_entry(request, payload: TimeEntryCreateRequest):
    return Status(201, handlers.create_time_entry(payload))


@router.patch(
    '/time-entries/{id}/',
    response=TimeEntry,
    operation_id='time_entries_partial_update',
)
def update_time_entry(request, id: int, payload: PatchedTimeEntryRequest):
    return handlers.update_time_entry(id, payload)


@router.delete(
    '/time-entries/{id}/',
    response={204: None},
    operation_id='time_entries_destroy',
)
def delete_time_entry(request, id: int):
    handlers.delete_time_entry(id)
    return Status(204, None)
