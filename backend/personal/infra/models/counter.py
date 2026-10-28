from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, String, Text, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from personal.infra.rules import normalize_counter_name

from .base import Base, UTCDateTime, utc_now
from .user import User


class Counter(Base):
    """A named tally; its total is the sum of its entries' values."""

    __tablename__ = 'counters'
    # The computed attributes below are plain annotations, not columns;
    # without this, SQLAlchemy refuses ``int | None`` outside ``Mapped[]``.
    __allow_unmapped__ = True

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)

    user: Mapped[User] = relationship()

    #: Computed from the entries by ``CounterRepository`` whenever it loads a
    #: counter; not stored.
    entry_count: int = 0
    total: int = 0
    #: Set by the counters use cases from the entry times, in the caller's
    #: time zone (``personal.core.counters.recency``); not stored.
    streak_days: int = 0
    days_since_last_entry: int | None = None

    def __repr__(self) -> str:
        return f'<Counter {self.id} {self.name!r}>'


@event.listens_for(Counter, 'before_insert')
@event.listens_for(Counter, 'before_update')
def _normalize_counter(mapper: Any, connection: Any, counter: Counter) -> None:
    counter.name = normalize_counter_name(counter.name)


class CounterEntry(Base):
    """One value added to a counter at a given moment."""

    __tablename__ = 'counter_entries'

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    counter_id: Mapped[int] = mapped_column(
        ForeignKey('counters.id', ondelete='CASCADE'), index=True
    )
    value: Mapped[int] = mapped_column(default=1)
    occurred_at: Mapped[datetime] = mapped_column(UTCDateTime)
    note: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)

    user: Mapped[User] = relationship()
    counter: Mapped[Counter] = relationship()

    def __repr__(self) -> str:
        return f'<CounterEntry {self.id} {self.value:+d}>'
