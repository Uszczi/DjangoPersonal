from datetime import date as datetime_date, datetime

from ninja import Schema
from pydantic import Field, field_validator

from apps.infra.models import normalize_project_name

MAX_ENTRY_DURATION_MINUTES = 24 * 60


class ProjectRequest(Schema):
    name: str = Field(min_length=1, max_length=100)
    description: str = ''

    @field_validator('name', mode='before')
    @classmethod
    def trim_name(cls, value):
        if isinstance(value, str):
            value = normalize_project_name(value)
            if not value:
                raise ValueError('This field may not be blank.')
        return value


class PatchedProjectRequest(ProjectRequest):
    name: str = Field(default=None, min_length=1, max_length=100)
    description: str = None


class Project(Schema):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    name: str
    description: str
    is_inbox: bool = Field(..., json_schema_extra={'readOnly': True})


class TaskCreateRequest(Schema):
    title: str = Field(min_length=1, max_length=200)
    description: str = ''
    project: int = None

    @field_validator('title', mode='before')
    @classmethod
    def trim_title(cls, value):
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError('This field may not be blank.')
        return value


class PatchedTaskUpdateRequest(TaskCreateRequest):
    title: str = Field(default=None, min_length=1, max_length=200)
    project: int = None
    is_completed: bool = None


class Task(Schema):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    title: str
    description: str
    project: int = Field(..., json_schema_extra={'readOnly': True})
    is_completed: bool = Field(..., json_schema_extra={'readOnly': True})

    @staticmethod
    def resolve_project(obj):
        return obj.project_id


class TimeEntryCreateRequest(Schema):
    task: int
    date: datetime_date
    duration_minutes: int = Field(ge=1, le=MAX_ENTRY_DURATION_MINUTES)


class PatchedTimeEntryRequest(Schema):
    task: int = None
    date: datetime_date = None
    duration_minutes: int = Field(
        default=None, ge=1, le=MAX_ENTRY_DURATION_MINUTES
    )


class TimeEntry(Schema):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    task: int = Field(..., json_schema_extra={'readOnly': True})
    start: datetime
    end: datetime | None = None

    @staticmethod
    def resolve_task(obj):
        return obj.task_id


class TimerStartRequest(Schema):
    task: int


class TimerState(Schema):
    entry: TimeEntry | None = None
    server_now: datetime
