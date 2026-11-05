"""Timer use cases: the single running time entry.

A timer started with a limit carries a ``planned_end``. Nothing runs in the
background to stop it; instead every use case that reads or changes the
running entry first settles it (`settle_expired_timer`), closing it at its
``planned_end`` once that moment has passed. The recorded time is therefore
exact however late the next request comes.

Start and Stop may carry ``at``, the moment the user pressed the button, so a
client that was offline can send them later and still record the time it
meant (see ``docs/research/offline-sync.md``).
"""
from datetime import datetime, timedelta

from personal.core.shared.errors import DomainError
from personal.core.work import clock
from personal.core.work.contracts import TimerStartRequest, TimerStopRequest
from personal.infra.models import TimeEntry as TimeEntryModel
from personal.infra.models import User
from personal.infra.repo import TaskRepository, TimeEntryRepository
from personal.infra.repo.errors import DuplicateTimeEntryId

from .tasks import _resolve_task


#: How long a client may hold a Start or Stop before sending it: a phone
#: offline for up to a week still records the time it meant.
MAX_DELAY = timedelta(days=7)

#: How far ahead of the server's clock an ``at`` may be; device clocks drift,
#: and the client corrects ``at`` by the offset it last measured.
MAX_CLOCK_SKEW = timedelta(minutes=1)


def resolve_moment(at: datetime | None) -> datetime:
    """When a timer action happened: ``at`` if given and plausible, else now.

    A moment slightly in the future (clock skew) counts as now; one further
    ahead, or older than :data:`MAX_DELAY`, is refused.
    """
    now = clock.now()
    if at is None:
        return now
    if at > now + MAX_CLOCK_SKEW:
        raise DomainError('The time of this action is in the future.')
    if at < now - MAX_DELAY:
        raise DomainError('This action is more than 7 days old and was not recorded.')
    return min(at, now)


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
        if data.id is not None:
            # The same Start sent again: it already happened.
            existing = self.time_entries.find(data.id, user=self.user)
            if existing is not None:
                return existing
        at = resolve_moment(data.at)
        settle_expired_timer(self.time_entries, self.user)
        running = self.time_entries.running(user=self.user)
        if running is not None and running.start > at:
            raise DomainError('A timer started later is already running.')
        planned_end = (
            None if data.duration_minutes is None else at + timedelta(minutes=data.duration_minutes)
        )
        try:
            entry = self.time_entries.switch(
                user=self.user,
                task=task,
                title=title,
                at=at,
                planned_end=planned_end,
                entry_id=data.id,
            )
        except DuplicateTimeEntryId as error:
            raise DomainError('This time entry id is already taken.') from error
        # A Start sent late with a limit may already be over.
        return settle_expired_timer(self.time_entries, self.user) or entry


class StopTimer:
    """Stop the running timer, or fail when none is running.

    A limited timer whose time is already up counts as stopped at its
    ``planned_end``, so stopping it late does not add the overrun.

    Naming the ``entry`` makes a late Stop safe: if that entry has already
    ended (its limit, another device's Stop or Start), it is returned as it
    is, and a timer started since is left running.
    """
    def __init__(self, time_entries: TimeEntryRepository, user: User):
        self.time_entries = time_entries
        self.user = user

    def execute(self, data: TimerStopRequest | None = None) -> TimeEntryModel:
        data = data or TimerStopRequest()
        at = resolve_moment(data.at)
        expired = settle_expired_timer(self.time_entries, self.user)
        if data.entry is not None:
            target = self.time_entries.find(data.entry, user=self.user)
            if target is None:
                raise DomainError('This timer no longer exists.')
            if target.end is not None:
                return target
        elif expired is not None:
            return expired
        running = self.time_entries.running(user=self.user)
        if running is None:
            raise DomainError('No timer is running.')
        if at < running.start:
            raise DomainError('The timer cannot stop before it started.')
        return self.time_entries.close(running, at=at)
