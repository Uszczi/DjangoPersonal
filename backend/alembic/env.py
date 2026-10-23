"""Alembic environment: migrates the database ``Settings`` points at (or ``sqlalchemy.url``)."""

from alembic import context
from sqlalchemy import create_engine

from apps.infra.models import Base
from config.app_settings import Settings

config = context.config


def database_url() -> str:
    """``sqlalchemy.url`` when given (tests, ``-x``), otherwise the application's database."""
    configured = config.get_main_option('sqlalchemy.url')
    if configured:
        return configured
    return Settings().database_url.render_as_string(hide_password=False)


def run_migrations_offline() -> None:
    context.configure(
        url=database_url(),
        target_metadata=Base.metadata,
        literal_binds=True,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(database_url())
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=Base.metadata,
            # SQLite cannot ALTER most things; batch mode rebuilds the table.
            render_as_batch=True,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
