"""SQLAlchemy engine and the request-scoped session.

One request is one transaction: :func:`get_session` opens a session, commits it
after the endpoint returns, and rolls it back if anything raised - this is what
replaces ``transaction.atomic()`` in the handlers. The commit runs *before* the
response is sent (``scope='function'``), so a failed commit becomes an error
response instead of a 2xx for work that was never stored.

:class:`Database` is built from :class:`~config.app_settings.Settings` and is not
tied to FastAPI, so the MCP server can share it later.
"""

from collections.abc import Iterator
from typing import Annotated, Any

from fastapi import Depends, Request
from sqlalchemy import Connection, Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from config.app_settings import Settings


def _configure_sqlite_connection(dbapi_connection: Any, connection_record: Any) -> None:
    # SQLite ignores foreign keys (and ON DELETE CASCADE) unless asked.
    cursor = dbapi_connection.cursor()
    cursor.execute('PRAGMA foreign_keys = ON')
    cursor.close()
    # pysqlite never emits BEGIN before SAVEPOINT, so releasing the outermost
    # savepoint would commit; BEGIN is sent explicitly instead (see ``begin``).
    dbapi_connection.isolation_level = None


def _begin_sqlite_transaction(connection: Connection) -> None:
    connection.exec_driver_sql('BEGIN')


def create_db_engine(settings: Settings) -> Engine:
    if settings.uses_postgres:
        return create_engine(
            settings.database_url,
            pool_pre_ping=True,
            pool_recycle=settings.db_connection_max_age_seconds,
        )

    # Sync endpoints and dependencies run in a threadpool, so one request may
    # touch its connection from more than one thread (never concurrently).
    engine = create_engine(
        settings.database_url,
        connect_args={'check_same_thread': False},
    )
    event.listen(engine, 'connect', _configure_sqlite_connection)
    event.listen(engine, 'begin', _begin_sqlite_transaction)
    return engine


class Database:
    def __init__(self, settings: Settings) -> None:
        self.engine = create_db_engine(settings)
        # No autoflush: a change reaches the database when a repository writes
        # it, not as a side effect of the next query a use case happens to run
        # (which would surface constraint errors outside the repository).
        self.session_factory = sessionmaker(self.engine, expire_on_commit=False, autoflush=False)

    def dispose(self) -> None:
        self.engine.dispose()


def get_session(request: Request) -> Iterator[Session]:
    database: Database = request.app.state.database
    session = database.session_factory()
    try:
        yield session
        session.commit()
    except BaseException:
        session.rollback()
        raise
    finally:
        session.close()


SessionDep = Annotated[Session, Depends(get_session, scope='function')]
