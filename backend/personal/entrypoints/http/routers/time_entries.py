from datetime import date as datetime_date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from personal.core.work import handlers
from personal.core.work.contracts import (
    PatchedTimeEntryRequest,
    TimeEntryCreateRequest,
    TimeEntryResponse,
    TimeEntryTitleResponse,
)
from personal.entrypoints.http.deps import CurrentUser, TaskRepositoryDep, TimeEntryRepositoryDep

router = APIRouter(tags=['personal'])


@router.get('/time-entries/', operation_id='time_entries_list')
def list_time_entries(
    user: CurrentUser,
    time_entries: TimeEntryRepositoryDep,
    task: UUID | None = None,
    date: datetime_date | None = None,
) -> list[TimeEntryResponse]:
    found = handlers.ListTimeEntries(time_entries, user).execute(task_id=task, day=date)
    return [TimeEntryResponse.model_validate(entry) for entry in found]


@router.get('/time-entries/titles/', operation_id='time_entries_titles')
def list_time_entry_titles(
    user: CurrentUser,
    time_entries: TimeEntryRepositoryDep,
    search: Annotated[str, Query(max_length=200)] = '',
    limit: Annotated[int, Query(ge=1, le=50)] = handlers.DEFAULT_TITLE_SUGGESTIONS,
) -> list[TimeEntryTitleResponse]:
    """Titles of past entries matching ``search``, to suggest when naming a new one."""
    found = handlers.SuggestTimeEntryTitles(time_entries, user).execute(search=search, limit=limit)
    return [TimeEntryTitleResponse(title=title, last_used=used) for title, used in found]


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
    id: UUID,
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
def delete_time_entry(id: UUID, user: CurrentUser, time_entries: TimeEntryRepositoryDep) -> None:
    handlers.DeleteTimeEntry(time_entries, user).execute(id)
