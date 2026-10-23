"""The declarative base every model shares, and the column types they reuse."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import DateTime, MetaData, inspect
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.sql.schema import CallableColumnDefault, ScalarElementColumnDefault
from sqlalchemy.types import TypeDecorator

#: Names for the constraints and indexes nobody names by hand, so Alembic can
#: refer to (and later drop) them by a predictable name on every backend.
NAMING_CONVENTION = {
    'ix': 'ix_%(table_name)s_%(column_0_N_name)s',
    'uq': 'uq_%(table_name)s_%(column_0_N_name)s',
    'ck': 'ck_%(table_name)s_%(constraint_name)s',
    'fk': 'fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s',
    'pk': 'pk_%(table_name)s',
}


def utc_now() -> datetime:
    return datetime.now(UTC)


class UTCDateTime(TypeDecorator[datetime]):
    """Timezone-aware datetimes, always handed back in UTC.

    Postgres stores ``timestamptz``; SQLite has no time zones and returns naive
    values, which are UTC because that is all this type ever writes.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError('Naive datetimes are not stored; pass an aware datetime.')
        return value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)

    def __init__(self, **kwargs: Any) -> None:
        """Build an instance with column defaults already filled in.

        SQLAlchemy applies ``default=`` only when the row is flushed, but the
        use cases read fields of objects they just built (a new project's
        ``terminal_status``, a new task's ``status``) before saving them.
        """
        cls = type(self)
        for attribute in inspect(cls).column_attrs:
            if attribute.key in kwargs:
                continue
            default = attribute.columns[0].default
            if isinstance(default, CallableColumnDefault):
                # SQLAlchemy wraps zero-argument callables to take an execution
                # context; ours never read it.
                setattr(self, attribute.key, default.arg(None))  # type: ignore[arg-type]
            elif isinstance(default, ScalarElementColumnDefault):
                setattr(self, attribute.key, default.arg)
        for key, value in kwargs.items():
            if not hasattr(cls, key):
                raise TypeError(f'{key!r} is an invalid keyword argument for {cls.__name__}')
            setattr(self, key, value)
