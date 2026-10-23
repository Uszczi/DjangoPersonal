"""Persistence for time entries."""
from datetime import date as datetime_date, datetime, time, timedelta
from datetime import timezone as datetime_timezone
from collections.abc import Sequence
from typing import Any

from django.db import transaction

from apps.infra.models import Task as TaskModel
from apps.infra.models import TimeEntry as TimeEntryModel
from apps.infra.models import User


def day_start(day: datetime_date) -> datetime:
    """Midnight UTC on the given calendar day.

    A manual entry starts at ``day_start`` of the date it was logged for, and a
    day filter covers ``[day_start(day), day_start(day + 1))``; both sides of
    that convention live here so they cannot drift apart.
    """
    return datetime.combine(day, time.min, tzinfo=datetime_timezone.utc)


class TimeEntryRepository:
    """Every database access the ``work`` app needs for time entries."""

    def list(
        self, *, task_id: int | None = None, day: datetime_date | None = None, user: User
    ) -> Sequence[TimeEntryModel]:
        """Entries for a task and/or a calendar day, newest first."""
        entries = TimeEntryModel.objects.filter(user=user)
        if task_id is not None:
            entries = entries.filter(task_id=task_id)
        if day is not None:
            start = day_start(day)
            entries = entries.filter(
                start__gte=start, start__lt=start + timedelta(days=1)
            )
        return list(entries)

    def find(self, entry_id: int, *, user: User) -> TimeEntryModel | None:
        """The entry with this id, or ``None``."""
        return TimeEntryModel.objects.filter(pk=entry_id, user=user).first()

    def running(self, *, user: User) -> TimeEntryModel | None:
        """The entry with a start but no end, if a timer is running."""
        return TimeEntryModel.objects.filter(end__isnull=True, user=user).first()

    def create(
        self,
        *,
        user: User,
        task: TaskModel | None = None,
        title: str = '',
        start: datetime,
        end: datetime | None = None,
    ) -> TimeEntryModel:
        return TimeEntryModel.objects.create(
            user=user, task=task, title=title, start=start, end=end
        )

    def save(self, entry: TimeEntryModel) -> TimeEntryModel:
        """Persist changes made to an existing entry."""
        entry.save()
        return entry

    def delete(self, entry: TimeEntryModel) -> None:
        entry.delete()

    def close(self, entry: TimeEntryModel, *, at: datetime) -> TimeEntryModel:
        """Mark an entry finished at ``at``, touching only its end."""
        entry.end = at
        entry.save(update_fields=['end'])
        return entry

    def switch(
        self,
        *,
        user: User,
        task: TaskModel | None = None,
        title: str = '',
        at: datetime,
    ) -> TimeEntryModel:
        """End any running entry and start a fresh one, atomically."""
        with transaction.atomic():
            running_qs = TimeEntryModel.objects.select_for_update().filter(end__isnull=True)
            if user is not None:
                running_qs = running_qs.filter(user=user)
            running = running_qs.first()
            if running is not None:
                self.close(running, at=at)
            return TimeEntryModel.objects.create(
                user=user, task=task, title=title, start=at
            )