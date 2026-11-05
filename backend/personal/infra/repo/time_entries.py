from collections.abc import Sequence
from datetime import date as datetime_date
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from personal.infra.models import Task as TaskModel
from personal.infra.models import TimeEntry as TimeEntryModel
from personal.infra.models import User
from personal.infra.rules import day_start

from ._flush import flush
from .errors import DuplicateTimeEntryId

#: Newest first; the id breaks ties between entries started at the same moment.
_NEWEST_FIRST = (TimeEntryModel.start.desc(), TimeEntryModel.id.desc())


class TimeEntryRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list(
        self, *, task_id: UUID | None = None, day: datetime_date | None = None, user: User
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

    def titles(self, *, user: User) -> Sequence[tuple[str, datetime]]:
        """Every distinct title the user's entries were recorded under, last used first.

        An entry on a Task without its own title counts under the Task's title.
        Each title comes with when an entry under it last started.
        """
        title = func.coalesce(func.nullif(TimeEntryModel.title, ''), TaskModel.title)
        last_used = func.max(TimeEntryModel.start)
        query = (
            select(title, last_used)
            .select_from(TimeEntryModel)
            .outerjoin(TaskModel, TimeEntryModel.task_id == TaskModel.id)
            .where(TimeEntryModel.user_id == user.id, title.is_not(None), title != '')
            .group_by(title)
            .order_by(last_used.desc(), title)
        )
        return [(name, used) for name, used in self.session.execute(query)]

    def find(self, entry_id: UUID, *, user: User) -> TimeEntryModel | None:
        query = select(TimeEntryModel).where(
            TimeEntryModel.id == entry_id, TimeEntryModel.user_id == user.id
        )
        return self.session.scalars(query).first()

    def running(self, *, user: User) -> TimeEntryModel | None:
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
        planned_end: datetime | None = None,
        entry_id: UUID | None = None,
    ) -> TimeEntryModel:
        """Add an entry; ``entry_id`` is a client-chosen id, else a fresh one."""
        entry = TimeEntryModel(
            user=user, task=task, title=title, start=start, end=end, planned_end=planned_end
        )
        if entry_id is not None:
            entry.id = entry_id
        self.session.add(entry)
        flush(self.session, on_conflict=DuplicateTimeEntryId)
        return entry

    def save(self, entry: TimeEntryModel) -> TimeEntryModel:
        self.session.add(entry)
        self.session.flush()
        return entry

    def delete(self, entry: TimeEntryModel) -> None:
        self.session.delete(entry)
        self.session.flush()

    def close(self, entry: TimeEntryModel, *, at: datetime) -> TimeEntryModel:
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
        planned_end: datetime | None = None,
        entry_id: UUID | None = None,
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
        return self.create(
            user=user, task=task, title=title, start=at, planned_end=planned_end, entry_id=entry_id
        )
