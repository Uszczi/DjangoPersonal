"""Project contracts: request payloads and the response shape."""

from typing import Any

from ninja import Schema
from pydantic import BaseModel, Field, field_validator

from apps.infra.models import normalize_project_name


class _ProjectPayload(BaseModel):
    """Name trimming shared by the create and the partial payloads.

    ``check_fields=False`` because this base declares no fields itself.
    """

    @field_validator('name', mode='before', check_fields=False)
    @classmethod
    def trim_name(cls, value: Any) -> Any:
        if isinstance(value, str):
            value = normalize_project_name(value)
            if not value:
                raise ValueError('This field may not be blank.')
        return value


class ProjectRequest(_ProjectPayload):
    name: str = Field(min_length=1, max_length=100)
    description: str = ''


class PatchedProjectRequest(_ProjectPayload):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None


class Project(Schema):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    name: str
    description: str
    is_inbox: bool = Field(..., json_schema_extra={'readOnly': True})
