"""Time entries endpoints."""

from datetime import date as datetime_date

from fastapi import APIRouter, Response, status

from apps.accounts.deps import CurrentUser
from apps.work import handlers
from apps.work.contracts import (
    PatchedTimeEntryRequest,
    TimeEntryCreateRequest,
    TimeEntryResponse,
)
from apps.work.deps import TaskRepositoryDep, TimeEntryRepositoryDep

router = APIRouter(tags=['personal'])


@router.get('/time-entries/', operation_id='time_entries_list')
def list_time_entries(
    user: CurrentUser,
    time_entries: TimeEntryRepositoryDep,
    task: int | None = None,
    date: datetime_date | None = None,
) -> list[TimeEntryResponse]:
    found = handlers.ListTimeEntries(time_entries, user).execute(task_id=task, day=date)
    return [TimeEntryResponse.model_validate(entry) for entry in found]


@router.post(
    '/time-entries/',
    status_code=status.HTTP_201_CREATED,
    operation_id='time_entries_create',
)
def create_time_entry(
    payload: TimeEntryCreateRequest,
    user: CurrentUser,
    tasks: TaskRepositoryDep,
    time_entries: TimeEntryRepositoryDep,
) -> TimeEntryResponse:
    handler = handlers.CreateTimeEntry(tasks=tasks, time_entries=time_entries, user=user)
    return TimeEntryResponse.model_validate(handler.execute(payload))


@router.patch('/time-entries/{id}/', operation_id='time_entries_partial_update')
def update_time_entry(
    id: int,
    payload: PatchedTimeEntryRequest,
    user: CurrentUser,
    tasks: TaskRepositoryDep,
    time_entries: TimeEntryRepositoryDep,
) -> TimeEntryResponse:
    handler = handlers.UpdateTimeEntry(tasks=tasks, time_entries=time_entries, user=user)
    return TimeEntryResponse.model_validate(handler.execute(id, payload))


@router.delete(
    '/time-entries/{id}/',
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id='time_entries_destroy',
)
def delete_time_entry(id: int, user: CurrentUser, time_entries: TimeEntryRepositoryDep) -> None:
    handlers.DeleteTimeEntry(time_entries, user).execute(id)
