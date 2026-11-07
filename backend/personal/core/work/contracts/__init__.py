"""Wire contract for ``work``.

The pydantic models that describe what goes in and out across every transport.
All models are plain ``pydantic.BaseModel`` instances, so requests and responses
share the same base class and drive the OpenAPI document.
The HTTP routers here, and a future MCP server, both import from this package
instead of defining their own shapes.
"""

from .comments import (
    CommentAttachmentResponse,
    PatchedTaskCommentRequest,
    TaskCommentCreateRequest,
    TaskCommentResponse,
)
from .projects import PatchedProjectRequest, ProjectRequest, ProjectResponse
from .tags import PatchedTagRequest, TagRequest, TagResponse
from .tasks import PatchedTaskUpdateRequest, TaskCreateRequest, TaskResponse
from .time_entries import (
    PatchedTimeEntryRequest,
    TimeEntryCreateRequest,
    TimeEntryResponse,
    TimeEntryTitleResponse,
)
from .timer import TimerResponse, TimerStartRequest, TimerStopRequest

__all__ = [
    'CommentAttachmentResponse',
    'PatchedTaskCommentRequest',
    'TaskCommentCreateRequest',
    'TaskCommentResponse',
    'PatchedProjectRequest',
    'PatchedTaskUpdateRequest',
    'PatchedTimeEntryRequest',
    'ProjectRequest',
    'ProjectResponse',
    'PatchedTagRequest',
    'TagRequest',
    'TagResponse',
    'TaskCreateRequest',
    'TaskResponse',
    'TimeEntryCreateRequest',
    'TimeEntryResponse',
    'TimeEntryTitleResponse',
    'TimerResponse',
    'TimerStartRequest',
    'TimerStopRequest',
]