"""Views for Counters and their entries."""

from personal.infra.models import Counter, CounterEntry

from .base import _AppView


class CounterView(_AppView, model=Counter):
    icon = 'fa-solid fa-hashtag'
    column_list = [Counter.id, Counter.user, Counter.name, Counter.color, Counter.created_at]
    column_searchable_list = [Counter.name]
    column_sortable_list = [Counter.id, Counter.name]
    form_columns = [Counter.name]


class CounterEntryView(_AppView, model=CounterEntry):
    name_plural = 'Counter entries'
    icon = 'fa-solid fa-list-ol'
    can_edit = False
    column_list = [
        CounterEntry.id,
        CounterEntry.user,
        CounterEntry.counter,
        CounterEntry.occurred_at,
        CounterEntry.value,
        CounterEntry.note,
    ]
    column_sortable_list = [CounterEntry.id, CounterEntry.occurred_at, CounterEntry.value]
