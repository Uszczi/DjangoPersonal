"""Small helpers shared by the database-level tests."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session


def count_rows(session: Session, model: type) -> int:
    return int(session.scalar(select(func.count()).select_from(model)) or 0)
