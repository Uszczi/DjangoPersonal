"""Persistence for time entries."""

from collections.abc import Sequence
from datetime import date as datetime_date
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from personal.infra.models import Task as TaskModel
from personal.infra.models import TimeEntry as TimeEntryModel
from personal.infra.models import User
from personal.infra.rules import day_start

#: Newest first; the id breaks ties between entries started at the same moment.
_NEWEST_FIRST = (TimeEntryModel.start.desc(), TimeEntryModel.id.desc())


class TimeEntryRepository:
    """Every database access the ``work`` use cases need for time entries."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def list(
        self, *, task_id: int | None = None, day: datetime_date | None = None, user: User
    ) -> Sequence[TimeEntryModel]:
        """Entries for a task and/or a calendar day, newest first."""
        query = select(TimeEntryModel).where(TimeEntryModel.user_id == user.id)
        if task_id is not None:
            query = query.where(TimeEntryModel.task_id == task_id)
        if day is not None:
            start = day_start(day)
            query = query.where(
                TimeEntryModel.start >= start, TimeEntryModel.start < start + timedelta(days=1)
            )
        return list(self.session.scalars(query.order_by(*_NEWEST_FIRST)))

    def find(self, entry_id: int, *, user: User) -> TimeEntryModel | None:
        """The entry with this id, or ``None``."""
        query = select(TimeEntryModel).where(
            TimeEntryModel.id == entry_id, TimeEntryModel.user_id == user.id
        )
        return self.session.scalars(query).first()

    def running(self, *, user: User) -> TimeEntryModel | None:
        """The entry with a start but no end, if a timer is running."""
        query = (
            select(TimeEntryModel)
            .where(TimeEntryModel.end.is_(None), TimeEntryModel.user_id == user.id)
            .order_by(*_NEWEST_FIRST)
        )
        return self.session.scalars(query).first()

    def create(
        self,
        *,
        user: User,
        task: TaskModel | None = None,
        title: str = '',
        start: datetime,
        end: datetime | None = None,
    ) -> TimeEntryModel:
        entry = TimeEntryModel(user=user, task=task, title=title, start=start, end=end)
        self.session.add(entry)
        self.session.flush()
        return entry

    def save(self, entry: TimeEntryModel) -> TimeEntryModel:
        """Persist changes made to an existing entry."""
        self.session.add(entry)
        self.session.flush()
        return entry

    def delete(self, entry: TimeEntryModel) -> None:
        self.session.delete(entry)
        self.session.flush()

    def close(self, entry: TimeEntryModel, *, at: datetime) -> TimeEntryModel:
        """Mark an entry finished at ``at``."""
        entry.end = at
        self.session.flush()
        return entry

    def switch(
        self,
        *,
        user: User,
        task: TaskModel | None = None,
        title: str = '',
        at: datetime,
    ) -> TimeEntryModel:
        """End any running entry and start a fresh one.

        The running entry is locked first (on Postgres), so two concurrent
        starts cannot both leave a timer running.
        """
        running = self.session.scalars(
            select(TimeEntryModel)
            .where(TimeEntryModel.end.is_(None), TimeEntryModel.user_id == user.id)
            .with_for_update()
        ).first()
        if running is not None:
            self.close(running, at=at)
        return self.create(user=user, task=task, title=title, start=at)
