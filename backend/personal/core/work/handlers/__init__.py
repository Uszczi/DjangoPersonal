"""Use cases for ``work``: projects, tasks, time entries and the timer.

Every use case is a class named after the action it performs, with a single
public ``execute`` method. It receives the repositories it needs through its
constructor (``personal.wiring`` is the composition root that supplies them),
takes validated input (one of the pydantic models in
:mod:`personal.core.work.contracts`), and signals rule violations with
:mod:`personal.core.shared.errors`. Anything that only supports those classes —
id lookups, validation, name normalisation — is a module-private helper, so the
handler surface stays unambiguous. None of the entrypoints (HTTP routers, MCP
tools, admin panel) own any of these rules; they only validate input,
assemble a use case, and shape the result.
"""

from personal.core.shared.errors import DomainError, NotFound

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
    'DomainError',
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
]
