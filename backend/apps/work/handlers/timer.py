"""Timer use cases: the single running time entry."""

from django.db import transaction

from apps.infra.models import TimeEntry as TimeEntryModel
from apps.work import clock
from apps.work.contracts import TimerStartRequest
from apps.work.errors import WorkError

from .tasks import resolve_task


def get_running_entry():
    return TimeEntryModel.objects.filter(end__isnull=True).first()


def start_timer(data: TimerStartRequest) -> TimeEntryModel:
    task = resolve_task(data.task)

    with transaction.atomic():
        running = (
            TimeEntryModel.objects.select_for_update().filter(end__isnull=True).first()
        )
        if running is not None:
            running.end = clock.now()
            running.save(update_fields=['end'])
        return TimeEntryModel.objects.create(task=task, start=clock.now())


def stop_timer() -> TimeEntryModel:
    running = get_running_entry()
    if running is None:
        raise WorkError('No timer is running.')
    running.end = clock.now()
    running.save(update_fields=['end'])
    return running
