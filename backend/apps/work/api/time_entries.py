from datetime import date as datetime_date

from collections.abc import Sequence
from django.http import HttpRequest
from typing import cast
from ninja import Router, Status
from ninja_jwt.authentication import JWTAuth

from apps.infra.models import TimeEntry as TimeEntryModel
from apps.infra.models import User
from apps.work import deps, handlers
from apps.work.contracts import (
    PatchedTimeEntryRequest,
    TimeEntryCreateRequest,
    TimeEntryResponse,
)

router = Router(tags=['personal'])


@router.get(
    '/time-entries/',
    response=list[TimeEntryResponse],
    auth=JWTAuth(),
    operation_id='time_entries_list',
)
def list_time_entries(
    request: HttpRequest, task: int | None = None, date: datetime_date | None = None
) -> Sequence[TimeEntryModel]:
    handler = handlers.ListTimeEntries(deps.time_entry_repository(), cast(User, request.user))
    return handler.execute(task_id=task, day=date)


@router.post(
    '/time-entries/',
    response={201: TimeEntryResponse},
    auth=JWTAuth(),
    operation_id='time_entries_create',
)
def create_time_entry(request: HttpRequest, payload: TimeEntryCreateRequest) -> Status[TimeEntryModel]:
    handler = handlers.CreateTimeEntry(
        tasks=deps.task_repository(),
        time_entries=deps.time_entry_repository(),
        user=cast(User, request.user),
    )
    return Status(201, handler.execute(payload))


@router.patch(
    '/time-entries/{id}/',
    response=TimeEntryResponse,
    auth=JWTAuth(),
    operation_id='time_entries_partial_update',
)
def update_time_entry(
    request: HttpRequest, id: int, payload: PatchedTimeEntryRequest
) -> TimeEntryModel:
    handler = handlers.UpdateTimeEntry(
        tasks=deps.task_repository(),
        time_entries=deps.time_entry_repository(),
        user=cast(User, request.user),
    )
    return handler.execute(id, payload)


@router.delete(
    '/time-entries/{id}/',
    response={204: None},
    auth=JWTAuth(),
    operation_id='time_entries_destroy',
)
def delete_time_entry(request: HttpRequest, id: int) -> Status[None]:
    handlers.DeleteTimeEntry(deps.time_entry_repository(), cast(User, request.user)).execute(id)
    return Status(204, None)