"""Composition root: builds the repositories use cases run against.

Callers (the HTTP routers, the MCP server) hand over the ``Session`` of the
current unit of work - one request or one tool call - and get repositories on
it. Every call returns a *fresh* repository, so one that later grows state
cannot leak it between requests. This is also the single place to swap the
concrete storage: a fake in a unit test, a caching wrapper in production.
"""

from sqlalchemy.orm import Session

from apps.infra.repo import ProjectRepository, TaskRepository, TimeEntryRepository


def project_repository(session: Session) -> ProjectRepository:
    return ProjectRepository(session)


def task_repository(session: Session) -> TaskRepository:
    return TaskRepository(session)


def time_entry_repository(session: Session) -> TimeEntryRepository:
    return TimeEntryRepository(session)
