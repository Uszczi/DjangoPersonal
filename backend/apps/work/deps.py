"""Composition root: builds the repositories use cases run against.

Every provider takes the ``Session`` of the current unit of work - one request
or one tool call - and returns a repository on it. As a FastAPI dependency the
session is the request's (``SessionDep``); the routers declare the ``*Dep``
aliases. Other callers (the MCP server) call the functions directly with a
session. Every call returns a *fresh* repository, so one that later grows state
cannot leak it between requests. This is also the single place to swap the
concrete storage: a fake in a unit test, a caching wrapper in production.
"""

from typing import Annotated

from fastapi import Depends

from apps.infra.repo import ProjectRepository, TaskRepository, TimeEntryRepository
from config.db import SessionDep


def project_repository(session: SessionDep) -> ProjectRepository:
    return ProjectRepository(session)


def task_repository(session: SessionDep) -> TaskRepository:
    return TaskRepository(session)


def time_entry_repository(session: SessionDep) -> TimeEntryRepository:
    return TimeEntryRepository(session)


ProjectRepositoryDep = Annotated[ProjectRepository, Depends(project_repository)]
TaskRepositoryDep = Annotated[TaskRepository, Depends(task_repository)]
TimeEntryRepositoryDep = Annotated[TimeEntryRepository, Depends(time_entry_repository)]
