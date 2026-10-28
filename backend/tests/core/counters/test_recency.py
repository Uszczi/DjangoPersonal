"""Counting a Counter's streak and the days since its last entry."""

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from personal.core.counters.recency import Recency, recency

WARSAW = ZoneInfo('Europe/Warsaw')
NOW = datetime(2026, 10, 20, 12, 0, tzinfo=UTC)


def at(day: int, hour: int = 8) -> datetime:
    return datetime(2026, 10, day, hour, 0, tzinfo=UTC)


def test_no_entries() -> None:
    assert recency([], now=NOW, tz=UTC) == Recency(streak_days=0, days_since_last_entry=None)


def test_streak_counts_days_in_a_row_ending_today() -> None:
    entries = [at(20), at(20, 9), at(19), at(18), at(16)]

    assert recency(entries, now=NOW, tz=UTC) == Recency(streak_days=3, days_since_last_entry=0)


def test_streak_lasts_while_yesterday_had_an_entry() -> None:
    assert recency([at(19), at(18)], now=NOW, tz=UTC) == Recency(
        streak_days=2, days_since_last_entry=1
    )


def test_a_missed_day_ends_the_streak() -> None:
    assert recency([at(18), at(17)], now=NOW, tz=UTC) == Recency(
        streak_days=0, days_since_last_entry=2
    )


def test_days_follow_the_callers_time_zone() -> None:
    # 22:30 UTC on the 19th is already the 20th in Warsaw.
    late = datetime(2026, 10, 19, 22, 30, tzinfo=UTC)

    assert recency([late], now=NOW, tz=UTC).days_since_last_entry == 1
    assert recency([late], now=NOW, tz=WARSAW).days_since_last_entry == 0


def test_future_entries_are_left_out() -> None:
    assert recency([at(25), at(19)], now=NOW, tz=UTC) == Recency(
        streak_days=1, days_since_last_entry=1
    )
