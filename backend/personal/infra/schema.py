"""Which Alembic revision the code expects and which one the database is at.

A deploy that skipped ``alembic upgrade head`` (or a stack running an old image)
fails in confusing ways: a new value breaks a check constraint, a new column is
missing. The API reports both revisions at startup (log line and the
``app_build_info`` metric), so the mismatch shows up in Grafana instead.
"""

from pathlib import Path

from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Engine

from personal.settings import BASE_DIR

ALEMBIC_DIR: Path = BASE_DIR / 'alembic'

UNKNOWN = 'unknown'


def code_revision() -> str:
    """The head revision of the migrations shipped with this code."""
    try:
        return ScriptDirectory(str(ALEMBIC_DIR)).get_current_head() or UNKNOWN
    except Exception:
        return UNKNOWN


def database_revision(engine: Engine) -> str:
    """The revision recorded in the database's ``alembic_version`` table."""
    try:
        with engine.connect() as connection:
            return MigrationContext.configure(connection).get_current_revision() or UNKNOWN
    except Exception:
        return UNKNOWN
