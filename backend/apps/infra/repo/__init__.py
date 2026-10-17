"""Repository layer for the ``infra`` app.

Repositories are the only place that touches the ORM. Each aggregates the
queries, writes, transactions and storage errors for one entity, and returns
model instances (or ``None`` when a lookup misses) for the use cases in
``apps.work.handlers`` to reason about. Because the direction of dependency is
``work`` -> ``infra``, nothing here imports ``apps.work``; failures a caller can
fix are raised as the errors in :mod:`.errors`.

Repositories are stateless: they hold no request data and read connections from
Django's per-thread handler, so one instance is safe to reuse. Use cases still
receive a fresh instance each time from ``apps.work.deps``, which keeps that an
accident that cannot happen rather than a rule to remember.
"""

from .errors import DuplicateProjectName, RepositoryError, TaskHasTimeEntries
from .projects import ProjectRepository
from .tasks import TaskRepository
from .time_entries import TimeEntryRepository, day_start

__all__ = [
    'DuplicateProjectName',
    'ProjectRepository',
    'RepositoryError',
    'TaskHasTimeEntries',
    'TaskRepository',
    'TimeEntryRepository',
    'day_start',
]
