"""The Alembic history builds exactly the schema the models describe."""

from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import Engine, create_engine, inspect

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


def test_downgrade_removes_everything(alembic_config: Config, migrated: Engine) -> None:
    command.downgrade(alembic_config, 'base')

    assert inspect(migrated).get_table_names() == ['alembic_version']
