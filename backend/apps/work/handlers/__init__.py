"""Application layer for the ``work`` app.

Every use case is a class named after the action it performs, with a single
public ``execute`` method. It receives the repositories it needs through its
constructor (``apps.work.deps`` is the composition root that supplies them),
takes validated input (one of the pydantic models in
:mod:`apps.work.contracts`), and signals rule violations with
:mod:`apps.work.errors`. Anything that only supports those classes — id
lookups, validation, name normalisation — is a module-private helper, so the
handler surface stays unambiguous. Neither the HTTP routers (``apps.work.api``)
nor a future MCP server own any of these rules; they only validate input,
assemble a use case, and shape the result.
"""

from apps.work.errors import NotFound, WorkError

from .projects import (
    CreateProject,
    DeleteProject,
    GetProject,
    ListProjects,
    ReplaceProject,
    UpdateProject,
)
from .tasks import CreateTask, DeleteTask, ListTasks, UpdateTask
from .time_entries import (
    CreateTimeEntry,
    DeleteTimeEntry,
    ListTimeEntries,
    UpdateTimeEntry,
)
from .timer import GetRunningEntry, StartTimer, StopTimer

__all__ = [
    'CreateProject',
    'CreateTask',
    'CreateTimeEntry',
    'DeleteProject',
    'DeleteTask',
    'DeleteTimeEntry',
    'GetProject',
    'GetRunningEntry',
    'ListProjects',
    'ListTasks',
    'ListTimeEntries',
    'NotFound',
    'ReplaceProject',
    'StartTimer',
    'StopTimer',
    'UpdateProject',
    'UpdateTask',
    'UpdateTimeEntry',
    'WorkError',
]
