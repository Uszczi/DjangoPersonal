"""Small helpers shared by the database-level tests."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

#: A well-formed id no row has (every id is a UUIDv7 made from the clock).
UNKNOWN_ID = str(UUID('00000000-0000-7000-8000-000000000000'))


def count_rows(session: Session, model: type) -> int:
    return int(session.scalar(select(func.count()).select_from(model)) or 0)
