"""Time entry use cases."""

from datetime import date as datetime_date, timedelta

from apps.infra.models import TimeEntry as TimeEntryModel
from apps.infra.repo import TaskRepository, TimeEntryRepository, day_start
from apps.work import clock
from apps.work.contracts import PatchedTimeEntryRequest, TimeEntryCreateRequest
from apps.work.errors import NotFound, WorkError

from .tasks import _resolve_task


def _ensure_not_future(value: datetime_date) -> None:
    if value > clock.now().date():
        raise WorkError('Date cannot be in the future.')


def _get_time_entry(repository, entry_id) -> TimeEntryModel:
    """Fetch a time entry addressed by id, or raise ``NotFound``."""
    entry = repository.find(entry_id)
    if entry is None:
        raise NotFound('Time entry not found.')
    return entry


class ListTimeEntries:
    """List time entries, optionally for one task and/or one calendar day."""

    def __init__(self, time_entries: TimeEntryRepository):
        self.time_entries = time_entries

    def execute(self, task_id=None, day: datetime_date | None = None):
        return self.time_entries.list(task_id=task_id, day=day)


class CreateTimeEntry:
    """Log a manual time entry for a task."""

    def __init__(self, tasks: TaskRepository, time_entries: TimeEntryRepository):
        self.tasks = tasks
        self.time_entries = time_entries

    def execute(self, data: TimeEntryCreateRequest) -> TimeEntryModel:
        task = _resolve_task(self.tasks, data.task)
        _ensure_not_future(data.date)

        start = day_start(data.date)
        return self.time_entries.create(
            task=task,
            start=start,
            end=start + timedelta(minutes=data.duration_minutes),
        )


class UpdateTimeEntry:
    """Apply the supplied fields to an existing time entry (PATCH)."""

    def __init__(self, tasks: TaskRepository, time_entries: TimeEntryRepository):
        self.tasks = tasks
        self.time_entries = time_entries

    def execute(self, entry_id, data: PatchedTimeEntryRequest) -> TimeEntryModel:
        entry = _get_time_entry(self.time_entries, entry_id)
        if entry.end is None:
            raise WorkError('The running timer cannot be edited.')

        provided = data.model_fields_set
        if 'task' in provided and data.task is not None:
            entry.task = _resolve_task(self.tasks, data.task)
        if provided & {'date', 'duration_minutes'} and (
            data.date is not None or data.duration_minutes is not None
        ):
            day = data.date if data.date is not None else entry.start.date()
            _ensure_not_future(day)
            current_duration = (entry.end - entry.start).total_seconds() // 60
            duration = (
                data.duration_minutes
                if data.duration_minutes is not None
                else current_duration
            )
            start = day_start(day)
            entry.start = start
            entry.end = start + timedelta(minutes=duration)
        return self.time_entries.save(entry)


class DeleteTimeEntry:
    """Delete a time entry addressed by id."""

    def __init__(self, time_entries: TimeEntryRepository):
        self.time_entries = time_entries

    def execute(self, entry_id) -> None:
        self.time_entries.delete(_get_time_entry(self.time_entries, entry_id))
