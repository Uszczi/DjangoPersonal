"""The admin panel: staff-only sign-in, and the Inbox survives a delete."""

from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from personal.entrypoints.admin import create_superuser
from personal.entrypoints.admin.app import create_app
from personal.infra import factories
from personal.infra.db import Database
from personal.infra.models import Category, Project, User, Whiteboard
from personal.settings import Settings

from .conftest import DEFAULT_PASSWORD


@pytest.fixture
def panel(settings: Settings, database: Database, session: Session) -> Iterator[TestClient]:
    factories.bind_session(session, commit=True)
    with TestClient(create_app(settings), follow_redirects=False) as client:
        yield client


def _sign_in(panel: TestClient, username: str, password: str = DEFAULT_PASSWORD) -> Any:
    return panel.post('/admin/login', data={'username': username, 'password': password})


def test_anonymous_requests_go_to_the_login_page(panel: TestClient) -> None:
    response = panel.get('/admin/project/list')

    assert response.status_code == 302
    assert response.headers['location'].endswith('/admin/login')


def test_non_staff_users_cannot_sign_in(
    panel: TestClient, make_user: Callable[..., User]
) -> None:
    make_user('regular')

    assert _sign_in(panel, 'regular').status_code == 400
    assert panel.get('/admin/project/list').status_code == 302


def test_wrong_password_is_refused(panel: TestClient, make_user: Callable[..., User]) -> None:
    make_user('boss', is_staff=True)

    assert _sign_in(panel, 'boss', 'wrong').status_code == 400


def test_staff_can_list_projects(panel: TestClient, make_user: Callable[..., User]) -> None:
    make_user('boss', is_staff=True)
    owner = make_user('owner')
    factories.ProjectFactory.create(user=owner, name='Garden')

    assert _sign_in(panel, 'boss').status_code == 302
    response = panel.get('/admin/project/list')

    assert response.status_code == 200
    assert 'Garden' in response.text


def test_revoking_staff_ends_the_session(
    panel: TestClient, make_user: Callable[..., User], session: Session
) -> None:
    boss = make_user('boss', is_staff=True)
    _sign_in(panel, 'boss')
    boss.is_staff = False
    session.commit()

    assert panel.get('/admin/project/list').status_code == 302


def _project_ids(session: Session, user: User) -> set[int]:
    session.expire_all()
    return set(session.scalars(select(Project.id).where(Project.user_id == user.id)))


def test_the_inbox_cannot_be_deleted(
    panel: TestClient, make_user: Callable[..., User], session: Session
) -> None:
    make_user('boss', is_staff=True)
    owner = make_user('owner')
    inbox = session.scalars(
        select(Project).where(Project.user_id == owner.id, Project.is_inbox)
    ).one()
    _sign_in(panel, 'boss')

    response = panel.delete(f'/admin/project/delete?pks={inbox.id}')

    assert 'Inbox+cannot+be+deleted' in response.text
    assert inbox.id in _project_ids(session, owner)


def test_other_projects_can_be_deleted(
    panel: TestClient, make_user: Callable[..., User], session: Session
) -> None:
    make_user('boss', is_staff=True)
    owner = make_user('owner')
    garden = factories.ProjectFactory.create(user=owner, name='Garden')
    _sign_in(panel, 'boss')

    panel.delete(f'/admin/project/delete?pks={garden.id}')

    assert garden.id not in _project_ids(session, owner)


# --- createsuperuser ----------------------------------------------------------


@pytest.fixture
def cli_env(monkeypatch: pytest.MonkeyPatch, settings: Settings, database: Database) -> None:
    """Point the CLI's ``Settings()`` at the test database and answer its prompts."""
    monkeypatch.setenv('SQLITE_PATH', str(settings.sqlite_path))
    monkeypatch.delenv('POSTGRES_HOST', raising=False)
    monkeypatch.setattr('getpass.getpass', lambda prompt: DEFAULT_PASSWORD)


def _user(session: Session, username: str) -> User:
    session.expire_all()
    return session.scalars(select(User).where(User.username == username)).one()


def test_createsuperuser_registers_a_staff_account(cli_env: None, session: Session) -> None:
    assert create_superuser.main(['admin']) == 0

    admin = _user(session, 'admin')
    assert admin.is_staff
    assert session.scalars(select(Category).where(Category.user_id == admin.id)).first()


def test_createsuperuser_promotes_an_existing_account(
    cli_env: None, session: Session, make_user: Callable[..., User]
) -> None:
    make_user('owner', is_active=False)

    assert create_superuser.main(['owner']) == 0

    owner = _user(session, 'owner')
    assert owner.is_staff
    assert owner.is_active


def test_createsuperuser_applies_the_password_policy(
    cli_env: None, monkeypatch: pytest.MonkeyPatch, session: Session
) -> None:
    monkeypatch.setattr('getpass.getpass', lambda prompt: '123')

    assert create_superuser.main(['admin']) == 1
    session.expire_all()
    assert session.scalars(select(User).where(User.username == 'admin')).first() is None


def test_every_view_renders(
    panel: TestClient, make_user: Callable[..., User], session: Session
) -> None:
    make_user('boss', is_staff=True)
    owner = make_user('owner')
    project = factories.ProjectFactory.create(user=owner, name='Garden')
    task = factories.TaskFactory.create(project=project)
    factories.TimeEntryFactory.create(user=owner, task=task)
    session.add(Whiteboard(user=owner, name='Board'))
    factories.TransactionFactory.create(user=owner)
    session.commit()
    _sign_in(panel, 'boss')

    for identity in (
        'user', 'project', 'task', 'time-entry', 'whiteboard', 'wallet', 'category', 'transaction'
    ):
        response = panel.get(f'/admin/{identity}/list')
        assert response.status_code == 200, identity
    assert panel.get(f'/admin/project/details/{project.id}').status_code == 200
    assert panel.get(f'/admin/project/edit/{project.id}').status_code == 200
    assert panel.get(f'/admin/user/edit/{owner.id}').status_code == 200
