from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from personal.infra.rules import normalize_pozycja_text

from .base import Base, UTCDateTime, utc_now
from .user import User


class Pozycja(Base):
    """One film or one book a user tracks in the Bibliografia.

    Its status is not stored: it follows from its Podejścia (see ``GLOSSARY.md``).
    """

    __tablename__ = 'pozycje'
    # ``status`` below is a plain annotation, not a column.
    __allow_unmapped__ = True
    __table_args__ = (
        CheckConstraint("kind IN ('film', 'book')", name='kind'),
        CheckConstraint('year IS NULL OR year > 0', name='year_positive'),
        CheckConstraint('length IS NULL OR length > 0', name='length_positive'),
    )

    KIND_FILM = 'film'
    KIND_BOOK = 'book'

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    kind: Mapped[str] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(String(300))
    #: The author or director, as written.
    creator: Mapped[str] = mapped_column(String(200), default='')
    year: Mapped[int | None] = mapped_column(default=None)
    #: Pages for a book, minutes for a film.
    length: Mapped[int | None] = mapped_column(default=None)
    note: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)

    user: Mapped[User] = relationship()

    #: The Pozycja status, derived by the ``bibliografia`` use cases; not stored.
    #: With no Podejścia yet every Pozycja is ``planned`` (Do obejrzenia / Do przeczytania).
    status: str = 'planned'

    def __repr__(self) -> str:
        return f'<Pozycja {self.id} {self.kind} {self.title!r}>'


@event.listens_for(Pozycja, 'before_insert')
@event.listens_for(Pozycja, 'before_update')
def _normalize_pozycja(mapper: Any, connection: Any, pozycja: Pozycja) -> None:
    pozycja.title = normalize_pozycja_text(pozycja.title)
    pozycja.creator = normalize_pozycja_text(pozycja.creator or '')
