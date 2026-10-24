import random

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from personal.entrypoints.seed_dev import USERS, DatabaseNotEmpty, seed
from personal.infra.models import Category, Project, Task, TimeEntry, User
from personal.infra.repo import UserRepository


def _count(session: Session, model: type) -> int:
    return int(session.scalar(select(func.count()).select_from(model)) or 0)


def test_seed_dev_populates_an_empty_database(session: Session) -> None:
    # A fixed seed keeps the demo data (and this test) reproducible.
    seed(session, random.Random(1), password_hash='hash')

    users = list(session.scalars(select(User)))
    assert sorted(user.username for user in users) == sorted(USERS)
    assert all(user.password == 'hash' for user in users)

    for user in users:
        projects = list(session.scalars(select(Project).where(Project.user_id == user.id)))
        assert sum(project.is_inbox for project in projects) == 1
        assert sum(not project.is_inbox for project in projects) == 3
        running = session.scalar(
            select(func.count())
            .select_from(TimeEntry)
            .where(TimeEntry.user_id == user.id, TimeEntry.end.is_(None))
        )
        assert running == 1
        assert session.scalar(
            select(func.count()).select_from(Category).where(Category.user_id == user.id)
        )

    assert _count(session, Task) > 0
    assert _count(session, TimeEntry) > _count(session, Task) / 2

    for entry in session.scalars(select(TimeEntry).where(TimeEntry.end.is_not(None))):
        assert entry.end is not None
        assert entry.end > entry.start


def test_seed_dev_refuses_to_seed_a_non_empty_database(session: Session) -> None:
    UserRepository(session).create(username='existing', password_hash='hash')

    with pytest.raises(DatabaseNotEmpty, match='Database is not empty'):
        seed(session, random.Random(1), password_hash='hash')

    assert _count(session, User) == 1
