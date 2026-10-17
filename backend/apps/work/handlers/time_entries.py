"""Time entry use cases."""

from datetime import date as datetime_date, datetime, time, timedelta
from datetime import timezone as datetime_timezone

from apps.infra.models import TimeEntry as TimeEntryModel
from apps.work import clock
from apps.work.contracts import PatchedTimeEntryRequest, TimeEntryCreateRequest
from apps.work.errors import NotFound, WorkError

from .tasks import resolve_task


def day_start(value: datetime_date) -> datetime:
    """Midnight UTC on the given calendar day."""
    return datetime.combine(value, time.min, tzinfo=datetime_timezone.utc)


def ensure_not_future(value: datetime_date) -> None:
    if value > clock.now().date():
        raise WorkError('Date cannot be in the future.')


def list_time_entries(task_id=None, day: datetime_date = None):
    entries = TimeEntryModel.objects.all()
    if task_id is not None:
        entries = entries.filter(task_id=task_id)
    if day is not None:
        start = day_start(day)
        entries = entries.filter(
            start__gte=start, start__lt=start + timedelta(days=1)
        )
    return entries


def get_time_entry(entry_id) -> TimeEntryModel:
    """Fetch a time entry addressed by id, or raise ``NotFound``."""
    entry = TimeEntryModel.objects.filter(pk=entry_id).first()
    if entry is None:
        raise NotFound('Time entry not found.')
    return entry


def create_time_entry(data: TimeEntryCreateRequest) -> TimeEntryModel:
    task = resolve_task(data.task)
    ensure_not_future(data.date)

    start = day_start(data.date)
    return TimeEntryModel.objects.create(
        task=task,
        start=start,
        end=start + timedelta(minutes=data.duration_minutes),
    )


def update_time_entry(entry_id, data: PatchedTimeEntryRequest) -> TimeEntryModel:
    entry = get_time_entry(entry_id)
    if entry.end is None:
        raise WorkError('The running timer cannot be edited.')

    changes = data.model_dump(exclude_unset=True)
    if 'task' in changes:
        entry.task = resolve_task(changes['task'])
    if 'date' in changes or 'duration_minutes' in changes:
        new_date = changes.get('date', entry.start.date())
        ensure_not_future(new_date)
        current_duration = (entry.end - entry.start).total_seconds() // 60
        duration = changes.get('duration_minutes', current_duration)
        start = day_start(new_date)
        entry.start = start
        entry.end = start + timedelta(minutes=duration)
    entry.save()
    return entry


def delete_time_entry(entry_id) -> None:
    get_time_entry(entry_id).delete()
