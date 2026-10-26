"""SQLAlchemy engine and the unit of work.

:meth:`Database.transaction` is one unit of work: a session committed when the
block ends and rolled back if anything raised - this is what replaces
``transaction.atomic()`` in the handlers. Every entrypoint runs one per call:
the HTTP API per request (``personal.entrypoints.http.deps.get_session``), the
MCP server per tool call. :class:`Database` is built from
:class:`~personal.settings.Settings` and knows nothing about any transport.
"""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from opentelemetry.sdk.trace import TracerProvider
from sqlalchemy import Connection, Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from personal.infra.tracing import instrument_engine
from personal.settings import Settings


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
    def __init__(self, settings: Settings, tracer_provider: TracerProvider | None = None) -> None:
        self.engine = create_db_engine(settings)
        if tracer_provider is not None:
            instrument_engine(self.engine, tracer_provider)
        # No autoflush: a change reaches the database when a repository writes
        # it, not as a side effect of the next query a use case happens to run
        # (which would surface constraint errors outside the repository).
        self.session_factory = sessionmaker(self.engine, expire_on_commit=False, autoflush=False)

    def dispose(self) -> None:
        self.engine.dispose()

    @contextmanager
    def transaction(self) -> Iterator[Session]:
        """A session committed when the block ends, rolled back if it raised."""
        session = self.session_factory()
        try:
            yield session
            session.commit()
        except BaseException:
            session.rollback()
            raise
        finally:
            session.close()
