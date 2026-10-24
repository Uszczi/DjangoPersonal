"""Wire contract for ``work``.

The pydantic models that describe what goes in and out across every transport.
All models are plain ``pydantic.BaseModel`` instances, so requests and responses
share the same base class and drive the OpenAPI document.
The HTTP routers here, and a future MCP server, both import from this package
instead of defining their own shapes.
"""

from .projects import PatchedProjectRequest, ProjectRequest, ProjectResponse
from .tasks import PatchedTaskUpdateRequest, TaskCreateRequest, TaskResponse
from .time_entries import (
    PatchedTimeEntryRequest,
    TimeEntryCreateRequest,
    TimeEntryResponse,
)
from .timer import TimerResponse, TimerStartRequest

__all__ = [
    'PatchedProjectRequest',
    'PatchedTaskUpdateRequest',
    'PatchedTimeEntryRequest',
    'ProjectRequest',
    'ProjectResponse',
    'TaskCreateRequest',
    'TaskResponse',
    'TimeEntryCreateRequest',
    'TimeEntryResponse',
    'TimerResponse',
    'TimerStartRequest',
]