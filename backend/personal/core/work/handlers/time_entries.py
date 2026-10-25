from collections.abc import Sequence
from datetime import date as datetime_date
from datetime import timedelta

from personal.core.shared.errors import DomainError, NotFound
from personal.core.work import clock
from personal.core.work.contracts import PatchedTimeEntryRequest, TimeEntryCreateRequest
from personal.infra.models import TimeEntry as TimeEntryModel
from personal.infra.models import User
from personal.infra.repo import TaskRepository, TimeEntryRepository, day_start

from .tasks import _resolve_task
from .timer import settle_expired_timer


def _ensure_not_future(value: datetime_date) -> None:
    if value > clock.now().date():
        raise DomainError('Date cannot be in the future.')


def _get_time_entry(
    repository: TimeEntryRepository, entry_id: int, *, user: User
) -> TimeEntryModel:
    entry = repository.find(entry_id, user=user)
    if entry is None:
        raise NotFound('Time entry not found.')
    return entry


class ListTimeEntries:
    """List time entries, optionally for one task and/or one calendar day."""
    def __init__(self, time_entries: TimeEntryRepository, user: User):
        self.time_entries = time_entries
        self.user = user

    def execute(
        self, task_id: int | None = None, day: datetime_date | None = None
    ) -> Sequence[TimeEntryModel]:
        settle_expired_timer(self.time_entries, self.user)
        return self.time_entries.list(task_id=task_id, day=day, user=self.user)


class CreateTimeEntry:
    """Log a manual time entry for a task or an ad-hoc title."""
    def __init__(
        self,
        tasks: TaskRepository,
        time_entries: TimeEntryRepository,
        user: User,
    ):
        self.tasks = tasks
        self.time_entries = time_entries
        self.user = user

    def execute(self, data: TimeEntryCreateRequest) -> TimeEntryModel:
        task = _resolve_task(self.tasks, data.task, user=self.user)
        title = (data.title or '').strip()
        if task is None and not title:
            raise DomainError('Provide a task or a title.')
        if task is not None and not title:
            title = ''
        _ensure_not_future(data.date)

        start = day_start(data.date)
        return self.time_entries.create(
            user=self.user,
            task=task,
            title=title,
            start=start,
            end=start + timedelta(minutes=data.duration_minutes),
        )


class UpdateTimeEntry:
    def __init__(
        self,
        tasks: TaskRepository,
        time_entries: TimeEntryRepository,
        user: User,
    ):
        self.tasks = tasks
        self.time_entries = time_entries
        self.user = user

    def execute(self, entry_id: int, data: PatchedTimeEntryRequest) -> TimeEntryModel:
        settle_expired_timer(self.time_entries, self.user)
        entry = _get_time_entry(self.time_entries, entry_id, user=self.user)
        if entry.end is None:
            raise DomainError('The running timer cannot be edited.')

        provided = data.model_fields_set
        if 'task' in provided:
            entry.task = _resolve_task(self.tasks, data.task, user=self.user)
        if 'title' in provided and data.title is not None:
            entry.title = data.title.strip()
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
    def __init__(self, time_entries: TimeEntryRepository, user: User):
        self.time_entries = time_entries
        self.user = user

    def execute(self, entry_id: int) -> None:
        self.time_entries.delete(_get_time_entry(self.time_entries, entry_id, user=self.user))