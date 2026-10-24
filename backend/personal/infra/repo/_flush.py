from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .errors import RepositoryError


def flush(session: Session, *, on_conflict: type[RepositoryError]) -> None:
    """Flush pending writes; a constraint violation raises ``on_conflict``.

    A failed flush ends the unit of work: the session must be rolled back
    before it is used again. That is what happens anyway - the use case turns
    the error into a domain error, which fails the request (or tool call) and
    rolls its transaction back. A savepoint would not help:
    ``Session.begin_nested()`` flushes pending changes *before* the savepoint
    exists, so an edited row would still fail outside it.
    """
    try:
        session.flush()
    except IntegrityError as error:
        raise on_conflict from error
