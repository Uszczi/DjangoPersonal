"""Counter and counter-entry use cases."""

from personal.core.shared.errors import NotFound
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
    """Fetch a counter addressed by id, or raise ``NotFound``."""
    counter = repository.find(counter_id, user=user)
    if counter is None:
        raise NotFound('Counter not found.')
    return counter


def _get_entry(
    repository: CounterEntryRepository, entry_id: int, *, user: User
) -> CounterEntryModel:
    """Fetch a counter entry addressed by id, or raise ``NotFound``."""
    entry = repository.find(entry_id, user=user)
    if entry is None:
        raise NotFound('Counter entry not found.')
    return entry


class ListCounters:
    def __init__(self, counters: CounterRepository, user: User):
        self.counters = counters
        self.user = user

    def execute(self) -> list[CounterModel]:
        return self.counters.list_all(user=self.user)


class GetCounter:
    def __init__(self, counters: CounterRepository, user: User):
        self.counters = counters
        self.user = user

    def execute(self, counter_id: int) -> CounterModel:
        return _get_counter(self.counters, counter_id, user=self.user)


class CreateCounter:
    def __init__(self, counters: CounterRepository, user: User):
        self.counters = counters
        self.user = user

    def execute(self, data: CounterRequest) -> CounterModel:
        return self.counters.save(CounterModel(user=self.user, name=data.name))


class UpdateCounter:
    """Apply the supplied fields to an existing counter (PATCH)."""

    def __init__(self, counters: CounterRepository, user: User):
        self.counters = counters
        self.user = user

    def execute(self, counter_id: int, data: PatchedCounterRequest) -> CounterModel:
        counter = _get_counter(self.counters, counter_id, user=self.user)
        apply_provided(data, counter)
        return self.counters.save(counter)


class DeleteCounter:
    """Delete a counter together with its entries."""

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
