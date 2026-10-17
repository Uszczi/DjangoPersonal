"""Wire contract for the ``work`` app.

The pydantic models that describe what goes in and out across every transport.
Request models are plain pydantic, so the handler layer never has to know about
them; response models are ``ninja.Schema`` so they drive the OpenAPI document.
The HTTP routers here, and a future MCP server, both import from this package
instead of defining their own shapes.
"""

from .projects import PatchedProjectRequest, Project, ProjectRequest
from .tasks import PatchedTaskUpdateRequest, Task, TaskCreateRequest
from .time_entries import (
    PatchedTimeEntryRequest,
    TimeEntry,
    TimeEntryCreateRequest,
)
from .timer import TimerStartRequest, TimerState

__all__ = [
    'PatchedProjectRequest',
    'PatchedTaskUpdateRequest',
    'PatchedTimeEntryRequest',
    'Project',
    'ProjectRequest',
    'Task',
    'TaskCreateRequest',
    'TimeEntry',
    'TimeEntryCreateRequest',
    'TimerStartRequest',
    'TimerState',
]
