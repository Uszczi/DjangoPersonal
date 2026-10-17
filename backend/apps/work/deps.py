"""Composition root: builds the repositories use cases run against.

The HTTP layer (``apps.work.api``) is the only adapter today; it asks this
module for the repositories it hands to a use case and nothing else needs to
know which storage backs them.

Every call returns a *fresh* repository. They are stateless as written — the
methods are only queries and writes, and Django hands out database connections
per thread — so sharing one instance would work too, but a fresh instance per
use case makes it impossible for a repository that later grows a field to leak
state between requests. It is also the single place to swap the concrete
storage: a fake in a unit test, a caching wrapper in production.
"""

from apps.infra.repo import ProjectRepository, TaskRepository, TimeEntryRepository


def project_repository() -> ProjectRepository:
    return ProjectRepository()


def task_repository() -> TaskRepository:
    return TaskRepository()


def time_entry_repository() -> TimeEntryRepository:
    return TimeEntryRepository()
