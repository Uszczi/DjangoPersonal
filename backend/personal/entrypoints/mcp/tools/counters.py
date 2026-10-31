"""Counter tools: counters and their entries."""

from typing import Any

from personal import wiring
from personal.core.counters import handlers as counter_handlers
from personal.core.counters.contracts import (
    CounterEntryRequest,
    CounterRequest,
    PatchedCounterEntryRequest,
    PatchedCounterRequest,
)
from personal.core.work import clock

from ..serialization import counter, counter_entries, counter_entry, counters
from .common import ToolContext, provided, tool, unit_of_work, zone


@tool
def list_counters(ctx: ToolContext, time_zone: str = 'UTC') -> list[dict[str, Any]]:
    """List counters with their entry count, total, streak and days since the last entry.

    ``time_zone`` (IANA, e.g. ``Europe/Warsaw``) sets where days begin.
    """
    tz = zone(time_zone)
    with unit_of_work(ctx) as (session, user):
        handler = counter_handlers.ListCounters(wiring.counter_repository(session), user, tz)
        return counters(handler.execute())


@tool
def get_counter(ctx: ToolContext, counter_id: int, time_zone: str = 'UTC') -> dict[str, Any]:
    """Fetch a single counter by id; ``time_zone`` as in ``list_counters``."""
    tz = zone(time_zone)
    with unit_of_work(ctx) as (session, user):
        handler = counter_handlers.GetCounter(wiring.counter_repository(session), user, tz)
        return counter(handler.execute(counter_id))


@tool
def create_counter(ctx: ToolContext, name: str, color: str | None = None) -> dict[str, Any]:
    """Create a counter. ``color`` is ``#RRGGBB``; it defaults to the app's teal."""
    payload = CounterRequest.model_validate({'name': name, **provided(color=color)})
    with unit_of_work(ctx) as (session, user):
        handler = counter_handlers.CreateCounter(wiring.counter_repository(session), user)
        return counter(handler.execute(payload))


@tool
def update_counter(
    ctx: ToolContext, counter_id: int, name: str | None = None, color: str | None = None
) -> dict[str, Any]:
    """Rename a counter or change its colour (``#RRGGBB``); only the given fields change."""
    payload = PatchedCounterRequest.model_validate(provided(name=name, color=color))
    with unit_of_work(ctx) as (session, user):
        handler = counter_handlers.UpdateCounter(wiring.counter_repository(session), user)
        return counter(handler.execute(counter_id, payload))


@tool
def delete_counter(ctx: ToolContext, counter_id: int) -> str:
    """Delete a counter and its entries."""
    with unit_of_work(ctx) as (session, user):
        counter_handlers.DeleteCounter(wiring.counter_repository(session), user).execute(counter_id)
        return 'deleted'


@tool
def list_counter_entries(ctx: ToolContext, counter_id: int) -> list[dict[str, Any]]:
    """List a counter's entries."""
    with unit_of_work(ctx) as (session, user):
        handler = counter_handlers.ListCounterEntries(
            wiring.counter_entry_repository(session), wiring.counter_repository(session), user
        )
        return counter_entries(handler.execute(counter_id))


@tool
def create_counter_entry(
    ctx: ToolContext,
    counter_id: int,
    value: int = 1,
    occurred_at: str | None = None,
    note: str = '',
) -> dict[str, Any]:
    """Add an entry to a counter (``value`` may be negative, not zero).
    ``occurred_at`` is ISO 8601 with a time zone; it defaults to now."""
    payload = CounterEntryRequest.model_validate(
        {
            'counter': counter_id,
            'value': value,
            'occurred_at': occurred_at if occurred_at is not None else clock.now(),
            'note': note,
        }
    )
    with unit_of_work(ctx) as (session, user):
        handler = counter_handlers.CreateCounterEntry(
            wiring.counter_entry_repository(session), wiring.counter_repository(session), user
        )
        return counter_entry(handler.execute(payload))


@tool
def update_counter_entry(
    ctx: ToolContext,
    entry_id: int,
    value: int | None = None,
    occurred_at: str | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    """Update a counter entry (partial)."""
    payload = PatchedCounterEntryRequest.model_validate(
        provided(value=value, occurred_at=occurred_at, note=note)
    )
    with unit_of_work(ctx) as (session, user):
        handler = counter_handlers.UpdateCounterEntry(
            wiring.counter_entry_repository(session), user
        )
        return counter_entry(handler.execute(entry_id, payload))


@tool
def delete_counter_entry(ctx: ToolContext, entry_id: int) -> str:
    """Delete a counter entry."""
    with unit_of_work(ctx) as (session, user):
        handler = counter_handlers.DeleteCounterEntry(
            wiring.counter_entry_repository(session), user
        )
        handler.execute(entry_id)
        return 'deleted'
