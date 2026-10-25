"""TimeEntryRepository: storage, filters and the running entry."""

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from personal.infra.models import (
    Project,
    Task,
    TimeEntry,
    User,
)
from personal.infra.repo import (
    ProjectHasTimeEntries,
    ProjectRepository,
    TaskHasTimeEntries,
    TaskRepository,
    TimeEntryRepository,
)
from tests.helpers import count_rows


def test_time_entries_protect_their_task_and_project(session: Session, user: User) -> None:
    projects, tasks = ProjectRepository(session), TaskRepository(session)
    project = projects.save(Project(user_id=user.id, name='Work'))
    task = tasks.create(title='t', description='', project=project, status='Todo')
    TimeEntryRepository(session).create(user=user, task=task, start=datetime.now(UTC))

    session.commit()

    with pytest.raises(TaskHasTimeEntries):
        tasks.delete(task)
    session.rollback()
    with pytest.raises(ProjectHasTimeEntries):
        projects.delete(project)
    session.rollback()

    assert count_rows(session, Task) == 1


def test_time_entries_round_trip_as_utc(session: Session, user: User) -> None:
    entries = TimeEntryRepository(session)
    start = datetime(2026, 10, 20, 9, 30, tzinfo=UTC)

    entry = entries.create(user=user, title='Manual', start=start, end=start + timedelta(hours=1))
    session.expire(entry)

    assert entry.start == start and entry.start.tzinfo is not None
    assert entry.end == start + timedelta(hours=1)


def test_time_entries_filter_by_task_and_day(session: Session, user: User) -> None:
    projects, tasks, entries = (
        ProjectRepository(session),
        TaskRepository(session),
        TimeEntryRepository(session),
    )
    task = tasks.create(
        title='t', description='', project=projects.get_inbox(user=user), status='Todo'
    )
    monday = datetime(2026, 10, 19, 23, 59, tzinfo=UTC)
    tuesday = datetime(2026, 10, 20, 0, 0, tzinfo=UTC)
    late = entries.create(user=user, task=task, start=monday, end=monday)
    early = entries.create(user=user, start=tuesday, end=tuesday)

    assert entries.list(user=user) == [early, late]
    assert entries.list(user=user, day=date(2026, 10, 20)) == [early]
    assert entries.list(user=user, task_id=task.id) == [late]
    assert entries.find(late.id, user=user) is late


def test_switching_ends_the_running_entry_and_starts_a_new_one(
    session: Session, user: User
) -> None:
    entries = TimeEntryRepository(session)
    began = datetime(2026, 10, 20, 9, 0, tzinfo=UTC)
    switched = began + timedelta(minutes=30)
    running = entries.create(user=user, title='first', start=began)
    assert entries.running(user=user) is running

    fresh = entries.switch(user=user, title='second', at=switched)

    assert running.end == switched
    assert entries.running(user=user) is fresh
    assert count_rows(session, TimeEntry) == 2


def test_closing_an_entry_only_sets_its_end(session: Session, user: User) -> None:
    entries = TimeEntryRepository(session)
    began = datetime(2026, 10, 20, 9, 0, tzinfo=UTC)
    entry = entries.create(user=user, title='t', start=began)

    entries.close(entry, at=began + timedelta(minutes=5))

    assert entry.end == began + timedelta(minutes=5) and entry.title == 't'
    entries.delete(entry)
    assert entries.find(entry.id, user=user) is None
