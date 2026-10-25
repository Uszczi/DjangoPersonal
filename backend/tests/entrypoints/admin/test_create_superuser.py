"""The createsuperuser command."""

from collections.abc import Callable

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from personal.entrypoints.admin import create_superuser
from personal.infra.db import Database
from personal.infra.models import Category, User
from personal.settings import Settings
from tests.conftest import DEFAULT_PASSWORD


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
