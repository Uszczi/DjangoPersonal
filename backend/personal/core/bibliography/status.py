"""The BibliographyItem status: never stored, always derived from its Attempts."""

from collections.abc import Iterable
from datetime import date
from typing import Protocol, cast

from .contracts import AttemptOutcome, ItemStatus


class AttemptLike(Protocol):
    """What the derivation needs from an Attempt."""

    @property
    def outcome(self) -> str: ...

    @property
    def ended_on(self) -> date | None: ...


def latest_attempt[T: AttemptLike](attempts: Iterable[T]) -> T | None:
    """The Attempt that decides the status.

    The one in progress if there is one, otherwise the one with the latest end date;
    the order they were added in does not matter (back-filling an old abandon does
    not override a later finish). On equal end dates the one given last wins.
    """
    latest: T | None = None
    for attempt in attempts:
        if attempt.outcome == 'in_progress':
            return attempt
        if latest is None or _ended(attempt) >= _ended(latest):
            latest = attempt
    return latest


def item_status(attempts: Iterable[AttemptLike]) -> ItemStatus:
    """``planned`` with no Attempts, else the latest Attempt's outcome."""
    latest = latest_attempt(attempts)
    if latest is None:
        return 'planned'
    return cast(AttemptOutcome, latest.outcome)


def _ended(attempt: AttemptLike) -> date:
    return attempt.ended_on or date.min
