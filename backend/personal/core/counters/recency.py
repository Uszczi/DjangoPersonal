"""How recently a Counter was used: its streak, or the days since its last entry.

Days are calendar days in the caller's time zone, so the same entries can give
a different answer in Warsaw and in UTC; the server has no zone of its own.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime, timedelta, tzinfo


@dataclass(frozen=True)
class Recency:
    #: Consecutive days with at least one entry, ending today or yesterday
    #: (a streak lasts until a whole day passes without an entry); else 0.
    streak_days: int
    #: Whole days from the last entry's day to today; ``None`` with no entries.
    days_since_last_entry: int | None


NO_ENTRIES = Recency(streak_days=0, days_since_last_entry=None)


def recency(occurred_at: Iterable[datetime], *, now: datetime, tz: tzinfo) -> Recency:
    """The Recency of entries that happened at ``occurred_at``.

    Entries dated in the future are left out: they have not happened yet.
    """
    today = now.astimezone(tz).date()
    days = {moment.astimezone(tz).date() for moment in occurred_at}
    days = {day for day in days if day <= today}
    if not days:
        return NO_ENTRIES
    last = max(days)
    streak = 0
    if (today - last).days <= 1:
        day: date = last
        while day in days:
            streak += 1
            day -= timedelta(days=1)
    return Recency(streak_days=streak, days_since_last_entry=(today - last).days)
