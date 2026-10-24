from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .errors import RepositoryError


def flush(session: Session, *, on_conflict: type[RepositoryError]) -> None:
    try:
        session.flush()
    except IntegrityError as error:
        raise on_conflict from error
