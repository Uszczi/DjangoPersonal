"""UserRepository: accounts, their Inbox, and the unit of work."""

from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from personal.infra.models import (
    Project,
    Task,
    TimeEntry,
    Transaction,
    User,
    Wallet,
    Whiteboard,
)
from personal.infra.repo import (
    DuplicateProjectName,
    DuplicateUsername,
    ProjectRepository,
    TaskRepository,
    TimeEntryRepository,
    TransactionRepository,
    UserRepository,
    WalletRepository,
    WhiteboardRepository,
)
from tests.helpers import count_rows


def test_creating_a_user_creates_their_inbox(session: Session, user: User) -> None:
    inbox = ProjectRepository(session).get_inbox(user=user)

    assert (inbox.name, inbox.normalized_name, inbox.is_inbox) == ('Inbox', 'inbox', True)
    assert inbox.project_statuses == ['Todo', 'Zrobione']
    assert inbox.terminal_status == 'Zrobione'
    assert user.is_active is True and user.is_staff is False
    assert user.date_joined.tzinfo is not None


def test_a_duplicate_username_is_a_repository_error(session: Session, user: User) -> None:
    session.commit()
    users = UserRepository(session)

    with pytest.raises(DuplicateUsername):
        users.create(username='repo-user', password_hash='other')
    session.rollback()

    assert users.get_by_username('repo-user') is user
    assert count_rows(session, Project) == 1


def test_usernames_are_compatibility_normalized(session: Session) -> None:
    user = UserRepository(session).create(username='ｕｓｅｒ', password_hash='hash')

    assert user.username == 'user'


def test_a_failed_write_is_undone_with_its_unit_of_work(session: Session, user: User) -> None:
    projects = ProjectRepository(session)
    projects.save(Project(user_id=user.id, name='Kept?'))
    with pytest.raises(DuplicateProjectName):
        projects.save(Project(user_id=user.id, name='kept?'))

    session.rollback()

    assert count_rows(session, User) == 0
    assert count_rows(session, Project) == 0


def test_deleting_a_user_deletes_all_of_their_data(session: Session, user: User) -> None:
    users = UserRepository(session)
    other = users.create(username='other', password_hash='hash')
    projects, tasks = ProjectRepository(session), TaskRepository(session)
    project = projects.save(Project(user_id=user.id, name='Work'))
    task = tasks.create(title='t', description='', project=project, status='Todo')
    TimeEntryRepository(session).create(user=user, task=task, start=datetime.now(UTC))
    WhiteboardRepository(session).create(user=user, name='Plan')
    wallet = WalletRepository(session).save(Wallet(user_id=user.id, name='Cash'))
    TransactionRepository(session).save(
        Transaction(
            title='t', amount=Decimal('1.00'), date=date(2026, 10, 23), user_id=user.id, wallet=wallet
        )
    )

    users.delete(user)
    session.commit()

    assert users.get_by_username('repo-user') is None
    assert users.get_by_username('other') is other
    for model in (Task, TimeEntry, Whiteboard, Wallet, Transaction):
        assert count_rows(session, model) == 0
    assert count_rows(session, Project) == 1


def test_a_password_hash_can_be_replaced(session: Session, user: User) -> None:
    UserRepository(session).set_password_hash(user, 'new-hash')

    session.expire(user)
    assert user.password == 'new-hash'
