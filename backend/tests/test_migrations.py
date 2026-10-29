"""The Alembic history builds exactly the schema the models describe."""

from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import Engine, create_engine, inspect, text

from alembic import command
from personal.infra.models import Base

BACKEND_DIR = Path(__file__).resolve().parent.parent


@pytest.fixture
def alembic_config(tmp_path: Path) -> Config:
    config = Config(str(BACKEND_DIR / 'alembic.ini'))
    config.set_main_option('script_location', str(BACKEND_DIR / 'alembic'))
    config.set_main_option('sqlalchemy.url', f'sqlite+pysqlite:///{tmp_path / "migrated.sqlite3"}')
    return config


@pytest.fixture
def migrated(alembic_config: Config) -> Engine:
    command.upgrade(alembic_config, 'head')
    return create_engine(alembic_config.get_main_option('sqlalchemy.url') or '')


def test_upgrade_head_matches_the_models(migrated: Engine) -> None:
    with migrated.connect() as connection:
        context = MigrationContext.configure(connection, opts={'compare_type': True})
        differences = compare_metadata(context, Base.metadata)

    assert differences == []


def test_the_domain_constraints_exist_by_name(migrated: Engine) -> None:
    schema = inspect(migrated)

    assert {c['name'] for c in schema.get_unique_constraints('projects')} >= {
        'project_name_unique_per_user'
    }
    assert {c['name'] for c in schema.get_check_constraints('projects')} == {
        'inbox_project_uses_reserved_name'
    }
    inbox_index = {i['name']: i for i in schema.get_indexes('projects')}['one_inbox_project_per_user']
    assert inbox_index['unique']
    assert {c['name'] for c in schema.get_unique_constraints('wallets')} == {
        'wallet_name_unique_per_user'
    }
    assert {c['name'] for c in schema.get_unique_constraints('categories')} == {
        'category_name_unique_per_user'
    }
    folder_indexes = {i['name']: i for i in schema.get_indexes('folders')}
    assert folder_indexes['folder_name_unique_at_top_level']['unique']
    assert folder_indexes['folder_name_unique_per_parent']['unique']
    whiteboard_indexes = {i['name']: i for i in schema.get_indexes('whiteboards')}
    assert whiteboard_indexes['whiteboard_name_unique_at_top_level']['unique']
    assert whiteboard_indexes['whiteboard_name_unique_per_folder']['unique']


def test_existing_duplicate_whiteboard_names_are_numbered(alembic_config: Config) -> None:
    command.upgrade(alembic_config, '0009')
    engine = create_engine(alembic_config.get_main_option('sqlalchemy.url') or '')
    board = (
        "INSERT INTO whiteboards (id, user_id, folder_id, kind, name, content, created_at, updated_at)"
        " VALUES (:id, :user, :folder, 'whiteboard', :name, '{}', '2026-01-01', '2026-01-01')"
    )
    with engine.begin() as connection:
        for user in (1, 2):
            connection.execute(
                text(
                    "INSERT INTO users (id, username, password, is_active, is_staff, date_joined)"
                    " VALUES (:id, :name, 'x', 1, 0, '2026-01-01')"
                ),
                {'id': user, 'name': f'user{user}'},
            )
        connection.execute(
            text(
                "INSERT INTO folders (id, user_id, name, normalized_name, created_at)"
                " VALUES (1, 1, 'Praca', 'praca', '2026-01-01')"
            )
        )
        for id_, user, folder, name in [
            (1, 1, None, 'Plan'),
            (2, 1, None, ' Plan '),
            (6, 1, None, 'plan'),
            (3, 1, None, 'Plan 2'),
            (4, 1, 1, 'Plan'),
            (5, 2, None, 'Plan'),
        ]:
            connection.execute(
                text(board), {'id': id_, 'user': user, 'folder': folder, 'name': name}
            )

    command.upgrade(alembic_config, 'head')

    with engine.connect() as connection:
        rows = connection.execute(text('SELECT id, name FROM whiteboards')).all()
    names: dict[int, str] = {row[0]: row[1] for row in rows}
    assert names == {1: 'Plan', 2: 'Plan 3', 3: 'Plan 2', 4: 'Plan', 5: 'Plan', 6: 'plan'}


def test_downgrade_removes_everything(alembic_config: Config, migrated: Engine) -> None:
    command.downgrade(alembic_config, 'base')

    assert inspect(migrated).get_table_names() == ['alembic_version']


def test_folder_names_lose_spaces_and_slashes(alembic_config: Config) -> None:
    command.upgrade(alembic_config, '0010')
    engine = create_engine(alembic_config.get_main_option('sqlalchemy.url') or '')
    folder = (
        "INSERT INTO folders (id, user_id, parent_id, name, normalized_name, created_at)"
        " VALUES (:id, 1, :parent, :name, :key, '2026-01-01')"
    )
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users (id, username, password, is_active, is_staff, date_joined)"
                " VALUES (1, 'user1', 'x', 1, 0, '2026-01-01')"
            )
        )
        for id_, parent, name in [
            (1, None, 'Klient-A'),
            (2, None, 'Klient A'),
            (3, None, 'Praca / 2026'),
            (4, 1, 'Klient A'),
        ]:
            connection.execute(
                text(folder),
                {'id': id_, 'parent': parent, 'name': name, 'key': name.casefold()},
            )

    command.upgrade(alembic_config, 'head')

    with engine.connect() as connection:
        rows = connection.execute(text('SELECT id, name FROM folders')).all()
    names: dict[int, str] = {row[0]: row[1] for row in rows}
    assert names == {1: 'Klient-A', 2: 'Klient-A-2', 3: 'Praca-2026', 4: 'Klient-A'}


def test_existing_categories_become_expense_ones(alembic_config: Config) -> None:
    command.upgrade(alembic_config, '0018')
    engine = create_engine(alembic_config.get_main_option('sqlalchemy.url') or '')
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users (id, username, password, is_active, is_staff, date_joined)"
                " VALUES (1, 'user1', 'x', 1, 0, '2026-01-01')"
            )
        )
        for id_, name, is_system in [(1, 'Jedzenie', 0), (2, 'System', 1)]:
            connection.execute(
                text(
                    "INSERT INTO categories (id, user_id, name, normalized_name, is_system, icon)"
                    " VALUES (:id, 1, :name, :key, :system, 'tag')"
                ),
                {'id': id_, 'name': name, 'key': name.casefold(), 'system': is_system},
            )

    command.upgrade(alembic_config, 'head')

    with engine.connect() as connection:
        rows = connection.execute(text('SELECT id, kind FROM categories')).all()
    assert {row[0]: row[1] for row in rows} == {1: 'expense', 2: 'expense'}
