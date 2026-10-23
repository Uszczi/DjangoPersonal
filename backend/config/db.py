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
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from config.app_settings import Settings


def _enable_sqlite_foreign_keys(dbapi_connection: Any, connection_record: Any) -> None:
    # Django turns this on for every SQLite connection; without it the FK
    # constraints (and ON DELETE CASCADE) are silently ignored.
    cursor = dbapi_connection.cursor()
    cursor.execute('PRAGMA foreign_keys = ON')
    cursor.close()


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
    event.listen(engine, 'connect', _enable_sqlite_foreign_keys)
    return engine


class Database:
    def __init__(self, settings: Settings) -> None:
        self.engine = create_db_engine(settings)
        self.session_factory = sessionmaker(self.engine, expire_on_commit=False)

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
