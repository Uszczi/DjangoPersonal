from datetime import date as datetime_date

from django.shortcuts import get_object_or_404
from ninja import Router, Status

from apps.infra.models import TimeEntry as TimeEntryModel

from . import services
from .schemas import PatchedTimeEntryRequest, TimeEntry, TimeEntryCreateRequest

router = Router(tags=['personal'])


@router.get(
    '/time-entries/',
    response=list[TimeEntry],
    operation_id='time_entries_list',
)
def list_time_entries(request, task: int = None, date: datetime_date = None):
    return services.list_time_entries(task_id=task, day=date)


@router.post(
    '/time-entries/',
    response={201: TimeEntry},
    operation_id='time_entries_create',
)
def create_time_entry(request, payload: TimeEntryCreateRequest):
    entry = services.create_manual_entry(
        payload.task, payload.date, payload.duration_minutes
    )
    return Status(201, entry)


@router.patch(
    '/time-entries/{id}/',
    response=TimeEntry,
    operation_id='time_entries_partial_update',
)
def update_time_entry(request, id: int, payload: PatchedTimeEntryRequest):
    entry = get_object_or_404(TimeEntryModel, pk=id)
    return services.update_entry(entry, payload.model_dump(exclude_unset=True))


@router.delete(
    '/time-entries/{id}/',
    response={204: None},
    operation_id='time_entries_destroy',
)
def delete_time_entry(request, id: int):
    entry = get_object_or_404(TimeEntryModel, pk=id)
    entry.delete()
    return Status(204, None)
