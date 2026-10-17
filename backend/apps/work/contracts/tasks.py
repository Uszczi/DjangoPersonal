"""Task contracts: request payloads and the response shape."""

from ninja import Schema
from pydantic import BaseModel, Field, field_validator


class TaskCreateRequest(BaseModel):
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
