from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, UTCDateTime
from .task import Task
from .user import User


class TimeEntry(Base):
    """Time spent on a task or on an ad-hoc title.

    An entry with no ``end`` is the running timer; there is at most one per
    user (enforced by the timer use cases, not the schema).
    """

    __tablename__ = 'time_entries'

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    #: No ``ON DELETE`` action: recorded time keeps its task (and project) alive.
    task_id: Mapped[int | None] = mapped_column(ForeignKey('tasks.id'), index=True)
    title: Mapped[str] = mapped_column(String(200), default='')
    start: Mapped[datetime] = mapped_column(UTCDateTime)
    end: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)

    user: Mapped[User] = relationship()
    task: Mapped[Task | None] = relationship()

    def __repr__(self) -> str:
        return f'<TimeEntry {self.id} {self.start} - {self.end}>'
