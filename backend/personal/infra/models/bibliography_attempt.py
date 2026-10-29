from datetime import date, datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, UTCDateTime, utc_now
from .bibliography_item import BibliographyItem
from .user import User


class Attempt(Base):
    """One time a user watches or reads a BibliographyItem (an Attempt, see ``GLOSSARY.md``).

    The use cases enforce the rules with friendly errors; the constraints here are
    the safety net: an end date exactly when it has ended, never before the start,
    progress only while in progress, and at most one Attempt in progress per
    BibliographyItem. Progress against the item's length is checked by the use cases.
    """

    __tablename__ = 'bibliography_attempts'
    __table_args__ = (
        CheckConstraint(
            "outcome IN ('in_progress', 'finished', 'abandoned')", name='outcome'
        ),
        CheckConstraint(
            "(outcome = 'in_progress') = (ended_on IS NULL)", name='ended_on_iff_ended'
        ),
        CheckConstraint(
            'started_on IS NULL OR ended_on IS NULL OR ended_on >= started_on',
            name='ends_after_start',
        ),
        CheckConstraint(
            "progress IS NULL OR (progress >= 0 AND outcome = 'in_progress')",
            name='progress_only_in_progress',
        ),
        Index(
            'uq_bibliography_attempts_one_in_progress',
            'item_id',
            unique=True,
            sqlite_where=text("outcome = 'in_progress'"),
            postgresql_where=text("outcome = 'in_progress'"),
        ),
    )

    OUTCOME_IN_PROGRESS = 'in_progress'
    OUTCOME_FINISHED = 'finished'
    OUTCOME_ABANDONED = 'abandoned'

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    item_id: Mapped[int] = mapped_column(
        ForeignKey('bibliography_items.id', ondelete='CASCADE'), index=True
    )
    outcome: Mapped[str] = mapped_column(String(20))
    #: Calendar days, no time of day.
    started_on: Mapped[date | None] = mapped_column(default=None)
    ended_on: Mapped[date | None] = mapped_column(default=None)
    #: How far the user is (a page for a book, a minute for a film); only while in progress.
    progress: Mapped[int | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)

    user: Mapped[User] = relationship()
    item: Mapped[BibliographyItem] = relationship()

    def __repr__(self) -> str:
        return f'<Attempt {self.id} {self.outcome} {self.started_on}..{self.ended_on}>'
