"""Timer use cases: the single running time entry.

A timer started with a limit carries a ``planned_end``. Nothing runs in the
background to stop it; instead every use case that reads or changes the
running entry first settles it (`settle_expired_timer`), closing it at its
``planned_end`` once that moment has passed. The recorded time is therefore
exact however late the next request comes.
"""
from datetime import timedelta

from personal.core.shared.errors import DomainError
from personal.core.work import clock
from personal.core.work.contracts import TimerStartRequest
from personal.infra.models import TimeEntry as TimeEntryModel
from personal.infra.models import User
from personal.infra.repo import TaskRepository, TimeEntryRepository

from .tasks import _resolve_task


def settle_expired_timer(time_entries: TimeEntryRepository, user: User) -> TimeEntryModel | None:
    """Stop the running timer at its ``planned_end`` if that has passed; return it if so."""
    running = time_entries.running(user=user)
    if running is None or running.planned_end is None or running.planned_end > clock.now():
        return None
    return time_entries.close(running, at=running.planned_end)


class GetRunningEntry:
    """The time entry with a start but no end, or ``None`` if idle."""
    def __init__(self, time_entries: TimeEntryRepository, user: User):
        self.time_entries = time_entries
        self.user = user

    def execute(self) -> TimeEntryModel | None:
        settle_expired_timer(self.time_entries, self.user)
        return self.time_entries.running(user=self.user)


class StartTimer:
    """Start a timer on a task or an ad-hoc title, ending any timer already running."""
    def __init__(
        self,
        tasks: TaskRepository,
        time_entries: TimeEntryRepository,
        user: User,
    ):
        self.tasks = tasks
        self.time_entries = time_entries
        self.user = user

    def execute(self, data: TimerStartRequest) -> TimeEntryModel:
        task = _resolve_task(self.tasks, data.task, user=self.user)
        title = (data.title or '').strip()
        if task is None and not title:
            raise DomainError('Provide a task or a title.')
        settle_expired_timer(self.time_entries, self.user)
        now = clock.now()
        planned_end = (
            None if data.duration_minutes is None else now + timedelta(minutes=data.duration_minutes)
        )
        return self.time_entries.switch(
            user=self.user, task=task, title=title, at=now, planned_end=planned_end
        )


class StopTimer:
    """Stop the running timer, or fail when none is running.

    A limited timer whose time is already up counts as stopped at its
    ``planned_end``, so stopping it late does not add the overrun.
    """
    def __init__(self, time_entries: TimeEntryRepository, user: User):
        self.time_entries = time_entries
        self.user = user

    def execute(self) -> TimeEntryModel:
        expired = settle_expired_timer(self.time_entries, self.user)
        if expired is not None:
            return expired
        running = self.time_entries.running(user=self.user)
        if running is None:
            raise DomainError('No timer is running.')
        return self.time_entries.close(running, at=clock.now())
