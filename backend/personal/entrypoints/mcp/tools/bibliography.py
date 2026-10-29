"""Bibliografia tools: items, their attempts, and the bulk import."""

from datetime import date as date_type
from typing import Any, Literal

from sqlalchemy.orm import Session

from personal import wiring
from personal.core.bibliography import handlers as bibliography_handlers
from personal.core.bibliography.contracts import (
    AttemptRequest,
    BibliographyImportRequest,
    BibliographyItemRequest,
    ImportedBibliographyItem,
    ItemKind,
    ItemStatus,
    PatchedAttemptRequest,
    PatchedBibliographyItemRequest,
)
from personal.core.work import clock
from personal.infra.models import User

from ..serialization import attempt, attempts, bibliography_item, bibliography_items
from .common import ToolContext, provided, tool, unit_of_work, zone


@tool
def list_bibliography_items(
    ctx: ToolContext, status: ItemStatus | None = None, kind: ItemKind | None = None
) -> list[dict[str, Any]]:
    """List the Bibliography's films and books, the most recently added first.

    ``status`` (derived from the item's attempts: ``planned`` = nothing started yet)
    and ``kind`` narrow the list."""
    with unit_of_work(ctx) as (session, user):
        handler = bibliography_handlers.ListBibliographyItems(
            wiring.bibliography_item_repository(session), wiring.attempt_repository(session), user
        )
        return bibliography_items(handler.execute(status=status, kind=kind))


@tool
def get_bibliography_item(ctx: ToolContext, item_id: int) -> dict[str, Any]:
    """Fetch one film or book with its status (``list_attempts`` gives its history)."""
    with unit_of_work(ctx) as (session, user):
        handler = bibliography_handlers.GetBibliographyItem(
            wiring.bibliography_item_repository(session), wiring.attempt_repository(session), user
        )
        return bibliography_item(handler.execute(item_id))


@tool
def create_bibliography_item(
    ctx: ToolContext,
    kind: ItemKind,
    title: str,
    creator: str = '',
    year: int | None = None,
    length: int | None = None,
    note: str = '',
) -> dict[str, Any]:
    """Add a film or book to the Bibliography. ``creator`` is the director or author;
    ``length`` is minutes for a film, pages for a book. The kind cannot change later."""
    payload = BibliographyItemRequest.model_validate(
        {
            'kind': kind,
            'title': title,
            'creator': creator,
            'year': year,
            'length': length,
            'note': note,
        }
    )
    with unit_of_work(ctx) as (session, user):
        handler = bibliography_handlers.CreateBibliographyItem(
            wiring.bibliography_item_repository(session), user
        )
        return bibliography_item(handler.execute(payload))


@tool
def update_bibliography_item(
    ctx: ToolContext,
    item_id: int,
    title: str | None = None,
    creator: str | None = None,
    year: int | None = None,
    length: int | None = None,
    note: str | None = None,
    kind: ItemKind | None = None,
) -> dict[str, Any]:
    """Update a film or book (partial). The kind is fixed at creation: passing
    ``kind`` is refused, so a wrong kind means adding the item again."""
    payload = PatchedBibliographyItemRequest.model_validate(
        provided(title=title, creator=creator, year=year, length=length, note=note, kind=kind)
    )
    with unit_of_work(ctx) as (session, user):
        handler = bibliography_handlers.UpdateBibliographyItem(
            wiring.bibliography_item_repository(session), wiring.attempt_repository(session), user
        )
        return bibliography_item(handler.execute(item_id, payload))


@tool
def delete_bibliography_item(ctx: ToolContext, item_id: int) -> str:
    """Delete a film or book together with all its attempts."""
    with unit_of_work(ctx) as (session, user):
        bibliography_handlers.DeleteBibliographyItem(
            wiring.bibliography_item_repository(session), user
        ).execute(item_id)
        return 'deleted'


@tool
def import_bibliography(
    ctx: ToolContext, items: list[ImportedBibliographyItem]
) -> dict[str, Any]:
    """Add many films and books at once, each with its past attempts (``finished`` or
    ``abandoned``, ``ended_on`` YYYY-MM-DD required). All or nothing: one broken rule
    fails the whole import and names the item. Returns the counts added."""
    payload = BibliographyImportRequest(items=items)
    with unit_of_work(ctx) as (session, user):
        handler = bibliography_handlers.ImportBibliography(
            wiring.bibliography_item_repository(session), wiring.attempt_repository(session), user
        )
        return handler.execute(payload).model_dump(mode='json')


def _create_attempt(session: Session, user: User) -> bibliography_handlers.CreateAttempt:
    return bibliography_handlers.CreateAttempt(
        wiring.attempt_repository(session), wiring.bibliography_item_repository(session), user
    )


def _update_attempt(session: Session, user: User) -> bibliography_handlers.UpdateAttempt:
    return bibliography_handlers.UpdateAttempt(wiring.attempt_repository(session), user)


def _today(time_zone: str) -> date_type:
    return clock.now().astimezone(zone(time_zone)).date()


@tool
def list_attempts(ctx: ToolContext, item_id: int) -> list[dict[str, Any]]:
    """The attempts at watching or reading one item, latest first (the one in progress,
    then by end date). ``progress`` is a page (book) or minute (film)."""
    with unit_of_work(ctx) as (session, user):
        handler = bibliography_handlers.ListAttempts(
            wiring.attempt_repository(session), wiring.bibliography_item_repository(session), user
        )
        return attempts(handler.execute(item_id))


@tool
def start_attempt(
    ctx: ToolContext,
    item_id: int,
    started_on: str | None = None,
    progress: int | None = None,
) -> dict[str, Any]:
    """Start watching or reading an item. ``started_on`` (YYYY-MM-DD) may be left
    out when unknown. An item has at most one attempt in progress."""
    payload = AttemptRequest.model_validate(
        {'item': item_id, 'outcome': 'in_progress', 'started_on': started_on, 'progress': progress}
    )
    with unit_of_work(ctx) as (session, user):
        return attempt(_create_attempt(session, user).execute(payload))


@tool
def record_attempt(
    ctx: ToolContext,
    item_id: int,
    outcome: Literal['finished', 'abandoned'] = 'finished',
    ended_on: str | None = None,
    started_on: str | None = None,
    time_zone: str = 'UTC',
) -> dict[str, Any]:
    """Record an attempt that has already ended, in one step. ``ended_on``
    (YYYY-MM-DD) defaults to today in ``time_zone`` (IANA, e.g. ``Europe/Warsaw``)."""
    payload = AttemptRequest.model_validate(
        {
            'item': item_id,
            'outcome': outcome,
            'started_on': started_on,
            'ended_on': ended_on if ended_on is not None else _today(time_zone),
        }
    )
    with unit_of_work(ctx) as (session, user):
        return attempt(_create_attempt(session, user).execute(payload))


def _end_attempt(
    ctx: ToolContext,
    attempt_id: int,
    outcome: Literal['finished', 'abandoned'],
    ended_on: str | None,
    time_zone: str,
) -> dict[str, Any]:
    payload = PatchedAttemptRequest.model_validate(
        {'outcome': outcome, 'ended_on': ended_on if ended_on is not None else _today(time_zone)}
    )
    with unit_of_work(ctx) as (session, user):
        return attempt(_update_attempt(session, user).execute(attempt_id, payload))


@tool
def finish_attempt(
    ctx: ToolContext, attempt_id: int, ended_on: str | None = None, time_zone: str = 'UTC'
) -> dict[str, Any]:
    """Finish the attempt in progress (its progress is dropped). ``ended_on``
    (YYYY-MM-DD) defaults to today in ``time_zone`` (IANA, e.g. ``Europe/Warsaw``)."""
    return _end_attempt(ctx, attempt_id, 'finished', ended_on, time_zone)


@tool
def abandon_attempt(
    ctx: ToolContext, attempt_id: int, ended_on: str | None = None, time_zone: str = 'UTC'
) -> dict[str, Any]:
    """Abandon the attempt in progress; ``ended_on`` as in ``finish_attempt``."""
    return _end_attempt(ctx, attempt_id, 'abandoned', ended_on, time_zone)


@tool
def delete_attempt(ctx: ToolContext, attempt_id: int) -> str:
    """Delete one attempt (e.g. recorded by mistake); the item's status follows."""
    with unit_of_work(ctx) as (session, user):
        bibliography_handlers.DeleteAttempt(wiring.attempt_repository(session), user).execute(
            attempt_id
        )
        return 'deleted'


@tool
def update_attempt(
    ctx: ToolContext,
    attempt_id: int,
    progress: int | None = None,
    started_on: str | None = None,
    ended_on: str | None = None,
    clear_progress: bool = False,
) -> dict[str, Any]:
    """Move on or re-date an attempt (partial). ``progress`` is the page (book) or
    minute (film) reached, only while in progress and never beyond the item's
    length; ``clear_progress`` removes it."""
    fields = provided(progress=progress, started_on=started_on, ended_on=ended_on)
    if clear_progress:
        fields['progress'] = None
    payload = PatchedAttemptRequest.model_validate(fields)
    with unit_of_work(ctx) as (session, user):
        return attempt(_update_attempt(session, user).execute(attempt_id, payload))
