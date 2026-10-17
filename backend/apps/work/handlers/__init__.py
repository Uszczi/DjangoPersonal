"""Application layer for the ``work`` app.

Every use case is a plain function that takes validated input (one of the
pydantic models in :mod:`apps.work.contracts`), talks to the ORM, and signals
rule violations with :mod:`apps.work.errors`. Neither the HTTP routers
(``apps.work.api``) nor the future MCP server own any of these rules; they only
validate input, call a handler, and shape the result.
"""

from apps.work.errors import NotFound, WorkError

from .projects import (
    create_project,
    delete_project,
    get_inbox,
    get_project,
    list_projects,
    replace_project,
    resolve_project,
    update_project,
)
from .tasks import (
    create_task,
    delete_task,
    get_task,
    list_tasks,
    resolve_task,
    update_task,
)
from .time_entries import (
    create_time_entry,
    delete_time_entry,
    get_time_entry,
    list_time_entries,
    update_time_entry,
)
from .timer import get_running_entry, start_timer, stop_timer

__all__ = [
    'NotFound',
    'WorkError',
    'create_project',
    'create_task',
    'create_time_entry',
    'delete_project',
    'delete_task',
    'delete_time_entry',
    'get_inbox',
    'get_project',
    'get_running_entry',
    'get_task',
    'get_time_entry',
    'list_projects',
    'list_tasks',
    'list_time_entries',
    'replace_project',
    'resolve_project',
    'resolve_task',
    'start_timer',
    'stop_timer',
    'update_project',
    'update_task',
    'update_time_entry',
]
