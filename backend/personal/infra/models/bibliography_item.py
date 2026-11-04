from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from personal.infra.rules import normalize_bibliography_item_text

from .base import Base, UTCDateTime, new_id, utc_now
from .user import User


class BibliographyItem(Base):
    """One film, book or series a user tracks in the Bibliography.

    Its status is not stored: the ``bibliography`` use cases derive it from its Attempts
    (see ``GLOSSARY.md``).
    """

    __tablename__ = 'bibliography_items'
    __table_args__ = (
        CheckConstraint("kind IN ('film', 'book', 'series')", name='kind'),
        CheckConstraint('year IS NULL OR year > 0', name='year_positive'),
        CheckConstraint('length IS NULL OR length > 0', name='length_positive'),
    )

    KIND_FILM = 'film'
    KIND_BOOK = 'book'
    KIND_SERIES = 'series'

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_id)
    user_id: Mapped[UUID] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    kind: Mapped[str] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(String(300))
    #: The author, director or a series' creator, as written.
    creator: Mapped[str] = mapped_column(String(200), default='')
    year: Mapped[int | None] = mapped_column(default=None)
    #: Pages for a book, minutes for a film, episodes for a series.
    length: Mapped[int | None] = mapped_column(default=None)
    note: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)

    user: Mapped[User] = relationship()

    def __repr__(self) -> str:
        return f'<BibliographyItem {self.id} {self.kind} {self.title!r}>'


@event.listens_for(BibliographyItem, 'before_insert')
@event.listens_for(BibliographyItem, 'before_update')
def _normalize_bibliography_item(mapper: Any, connection: Any, item: BibliographyItem) -> None:
    item.title = normalize_bibliography_item_text(item.title)
    item.creator = normalize_bibliography_item_text(item.creator or '')
