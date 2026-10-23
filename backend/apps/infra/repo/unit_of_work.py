"""The transaction boundary use cases may draw around several repository calls."""

from collections.abc import Iterator
from contextlib import contextmanager

from django.db import transaction


@contextmanager
def unit_of_work() -> Iterator[None]:
    """Run the enclosed repository calls atomically: all of them or none.

    Use cases reach for this instead of ``django.db.transaction`` so they stay
    ignorant of the storage backend; only this module knows how the boundary
    is drawn. Nesting is allowed and behaves like a savepoint.
    """
    with transaction.atomic():
        yield
