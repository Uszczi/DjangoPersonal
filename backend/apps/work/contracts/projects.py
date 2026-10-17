"""Project contracts: request payloads and the response shape."""

from ninja import Schema
from pydantic import BaseModel, Field, field_validator

from apps.infra.models import normalize_project_name


class ProjectRequest(BaseModel):
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
