from datetime import UTC, tzinfo

from personal.core.counters.recency import recency
from personal.core.shared.errors import NotFound
from personal.core.work import clock
from personal.core.shared.patch import apply_provided
from personal.infra.models import Counter as CounterModel
from personal.infra.models import CounterEntry as CounterEntryModel
from personal.infra.models import User
from personal.infra.repo import CounterEntryRepository, CounterRepository

from ..contracts import (
    CounterEntryRequest,
    CounterRequest,
    PatchedCounterEntryRequest,
    PatchedCounterRequest,
)


def _get_counter(repository: CounterRepository, counter_id: int, *, user: User) -> CounterModel:
    counter = repository.find(counter_id, user=user)
    if counter is None:
        raise NotFound('Counter not found.')
    return counter


def _with_recency(
    repository: CounterRepository, counters: list[CounterModel], *, user: User, tz: tzinfo
) -> list[CounterModel]:
    """Fill in each counter's streak and days since its last entry, as of now in ``tz``."""
    now = clock.now()
    times = repository.entry_times(counters, user=user)
    for counter in counters:
        found = recency(times[counter.id], now=now, tz=tz)
        counter.streak_days = found.streak_days
        counter.days_since_last_entry = found.days_since_last_entry
    return counters


def _get_entry(
    repository: CounterEntryRepository, entry_id: int, *, user: User
) -> CounterEntryModel:
    entry = repository.find(entry_id, user=user)
    if entry is None:
        raise NotFound('Counter entry not found.')
    return entry


class ListCounters:
    """``tz`` is the caller's time zone: it sets where days begin for the streak."""

    def __init__(self, counters: CounterRepository, user: User, tz: tzinfo = UTC):
        self.counters = counters
        self.user = user
        self.tz = tz

    def execute(self) -> list[CounterModel]:
        counters = self.counters.list_all(user=self.user)
        return _with_recency(self.counters, counters, user=self.user, tz=self.tz)


class GetCounter:
    """``tz`` is the caller's time zone: it sets where days begin for the streak."""

    def __init__(self, counters: CounterRepository, user: User, tz: tzinfo = UTC):
        self.counters = counters
        self.user = user
        self.tz = tz

    def execute(self, counter_id: int) -> CounterModel:
        counter = _get_counter(self.counters, counter_id, user=self.user)
        return _with_recency(self.counters, [counter], user=self.user, tz=self.tz)[0]


class CreateCounter:
    """``tz`` is the caller's time zone: it sets where days begin for the streak."""

    def __init__(self, counters: CounterRepository, user: User, tz: tzinfo = UTC):
        self.counters = counters
        self.user = user
        self.tz = tz

    def execute(self, data: CounterRequest) -> CounterModel:
        counter = self.counters.save(CounterModel(user=self.user, name=data.name))
        return _with_recency(self.counters, [counter], user=self.user, tz=self.tz)[0]


class UpdateCounter:
    """``tz`` is the caller's time zone: it sets where days begin for the streak."""

    def __init__(self, counters: CounterRepository, user: User, tz: tzinfo = UTC):
        self.counters = counters
        self.user = user
        self.tz = tz

    def execute(self, counter_id: int, data: PatchedCounterRequest) -> CounterModel:
        counter = _get_counter(self.counters, counter_id, user=self.user)
        apply_provided(data, counter)
        counter = self.counters.save(counter)
        return _with_recency(self.counters, [counter], user=self.user, tz=self.tz)[0]


class DeleteCounter:
    def __init__(self, counters: CounterRepository, user: User):
        self.counters = counters
        self.user = user

    def execute(self, counter_id: int) -> None:
        self.counters.delete(_get_counter(self.counters, counter_id, user=self.user))


class ListCounterEntries:
    """List one counter's entries, newest first."""

    def __init__(
        self, entries: CounterEntryRepository, counters: CounterRepository, user: User
    ):
        self.entries = entries
        self.counters = counters
        self.user = user

    def execute(self, counter_id: int) -> list[CounterEntryModel]:
        _get_counter(self.counters, counter_id, user=self.user)
        return self.entries.list_for_counter(counter_id, user=self.user)


class GetCounterEntry:
    def __init__(self, entries: CounterEntryRepository, user: User):
        self.entries = entries
        self.user = user

    def execute(self, entry_id: int) -> CounterEntryModel:
        return _get_entry(self.entries, entry_id, user=self.user)


class CreateCounterEntry:
    def __init__(
        self, entries: CounterEntryRepository, counters: CounterRepository, user: User
    ):
        self.entries = entries
        self.counters = counters
        self.user = user

    def execute(self, data: CounterEntryRequest) -> CounterEntryModel:
        entry = CounterEntryModel(
            user=self.user,
            counter=_get_counter(self.counters, data.counter, user=self.user),
            value=data.value,
            occurred_at=data.occurred_at,
            note=data.note,
        )
        return self.entries.save(entry)


class UpdateCounterEntry:
    """Apply the supplied fields to an existing entry (PATCH); it stays in its counter."""

    def __init__(self, entries: CounterEntryRepository, user: User):
        self.entries = entries
        self.user = user

    def execute(self, entry_id: int, data: PatchedCounterEntryRequest) -> CounterEntryModel:
        entry = _get_entry(self.entries, entry_id, user=self.user)
        apply_provided(data, entry)
        return self.entries.save(entry)


class DeleteCounterEntry:
    def __init__(self, entries: CounterEntryRepository, user: User):
        self.entries = entries
        self.user = user

    def execute(self, entry_id: int) -> None:
        self.entries.delete(_get_entry(self.entries, entry_id, user=self.user))
