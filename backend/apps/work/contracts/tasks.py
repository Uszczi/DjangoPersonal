"""Task contracts: request payloads and the response shape."""

from typing import Any

from ninja import Schema
from pydantic import BaseModel, Field, field_validator


class _TaskPayload(BaseModel):
    """Title trimming shared by the create and the partial payloads.

    ``check_fields=False`` because this base declares no fields itself.
    """

    @field_validator('title', mode='before', check_fields=False)
    @classmethod
    def trim_title(cls, value: Any) -> Any:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError('This field may not be blank.')
        return value


class TaskCreateRequest(_TaskPayload):
    title: str = Field(min_length=1, max_length=200)
    description: str = ''
    project: int | None = None


class PatchedTaskUpdateRequest(_TaskPayload):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    project: int | None = None
    is_completed: bool | None = None


class Task(Schema):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    title: str
    description: str
    project: int = Field(..., json_schema_extra={'readOnly': True})
    is_completed: bool = Field(..., json_schema_extra={'readOnly': True})

    @staticmethod
    def resolve_project(obj: Any) -> int:
        return int(obj.project_id)
