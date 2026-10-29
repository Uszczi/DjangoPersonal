"""Deriving a BibliographyItem status from its Attempts."""

from dataclasses import dataclass
from datetime import date

from personal.core.bibliography.status import item_status


@dataclass
class Attempt:
    outcome: str
    ended_on: date | None = None


def test_no_attempts_means_planned() -> None:
    assert item_status([]) == 'planned'


def test_a_attempt_in_progress_means_in_progress() -> None:
    assert item_status([Attempt('in_progress')]) == 'in_progress'


def test_a_finished_attempt_means_finished() -> None:
    assert item_status([Attempt('finished', date(2026, 10, 1))]) == 'finished'


def test_an_abandoned_attempt_means_abandoned() -> None:
    assert item_status([Attempt('abandoned', date(2026, 10, 1))]) == 'abandoned'


def test_an_open_attempt_wins_over_later_ended_ones() -> None:
    attempts = [Attempt('finished', date(2026, 10, 28)), Attempt('in_progress')]

    assert item_status(attempts) == 'in_progress'


def test_the_latest_end_date_decides_not_the_order_added() -> None:
    # Finished in 2026, then an abandon from 2019 is back-filled.
    attempts = [
        Attempt('finished', date(2026, 3, 1)),
        Attempt('abandoned', date(2019, 5, 1)),
    ]

    assert item_status(attempts) == 'finished'


def test_resuming_after_an_abandon_and_finishing_means_finished() -> None:
    attempts = [
        Attempt('abandoned', date(2025, 1, 10)),
        Attempt('finished', date(2026, 2, 1)),
    ]

    assert item_status(attempts) == 'finished'
