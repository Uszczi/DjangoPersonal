"""Use cases for ``work``: projects, tasks and their tags, time entries and the timer.

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

from .comments import (
    AddCommentAttachment,
    CreateTaskComment,
    DeleteCommentAttachment,
    DeleteTaskComment,
    GetCommentAttachment,
    ListTaskComments,
    UpdateTaskComment,
)
from .projects import (
    CreateProject,
    DeleteProject,
    GetProject,
    ListProjects,
    ReplaceProject,
    UpdateProject,
)
from .tags import CreateTag, DeleteTag, GetTag, ListTags, UpdateTag
from .tasks import CreateTask, DeleteTask, ListTasks, UpdateTask
from .time_entries import (
    DEFAULT_TITLE_SUGGESTIONS,
    CreateTimeEntry,
    DeleteTimeEntry,
    ListTimeEntries,
    SuggestTimeEntryTitles,
    UpdateTimeEntry,
)
from .timer import GetRunningEntry, StartTimer, StopTimer

__all__ = [
    'AddCommentAttachment',
    'DEFAULT_TITLE_SUGGESTIONS',
    'CreateTaskComment',
    'DeleteCommentAttachment',
    'DeleteTaskComment',
    'GetCommentAttachment',
    'ListTaskComments',
    'UpdateTaskComment',
    'CreateProject',
    'CreateTag',
    'CreateTask',
    'CreateTimeEntry',
    'DeleteProject',
    'DeleteTag',
    'DeleteTask',
    'DeleteTimeEntry',
    'DomainError',
    'GetProject',
    'GetRunningEntry',
    'GetTag',
    'ListProjects',
    'ListTags',
    'ListTasks',
    'ListTimeEntries',
    'NotFound',
    'ReplaceProject',
    'StartTimer',
    'StopTimer',
    'SuggestTimeEntryTitles',
    'UpdateProject',
    'UpdateTag',
    'UpdateTask',
    'UpdateTimeEntry',
]
