"""Timer use cases: the single running time entry."""

from apps.infra.models import TimeEntry as TimeEntryModel
from apps.infra.repo import TaskRepository, TimeEntryRepository
from apps.work import clock
from apps.work.contracts import TimerStartRequest
from apps.work.errors import WorkError

from .tasks import _resolve_task


class GetRunningEntry:
    """The time entry with a start but no end, or ``None`` if idle."""

    def __init__(self, time_entries: TimeEntryRepository):
        self.time_entries = time_entries

    def execute(self) -> TimeEntryModel | None:
        return self.time_entries.running()


class StartTimer:
    """Start a timer on a task, ending any timer already running."""

    def __init__(self, tasks: TaskRepository, time_entries: TimeEntryRepository):
        self.tasks = tasks
        self.time_entries = time_entries

    def execute(self, data: TimerStartRequest) -> TimeEntryModel:
        task = _resolve_task(self.tasks, data.task)
        return self.time_entries.switch(task=task, at=clock.now())


class StopTimer:
    """Stop the running timer, or fail when none is running."""

    def __init__(self, time_entries: TimeEntryRepository):
        self.time_entries = time_entries

    def execute(self) -> TimeEntryModel:
        running = self.time_entries.running()
        if running is None:
            raise WorkError('No timer is running.')
        return self.time_entries.close(running, at=clock.now())
