from pydantic import Field, field_validator

from personal.core.shared.base import BaseModel
from personal.infra.rules import (
    MAX_STATUS_LENGTH,
    MAX_STATUSES,
    normalize_project_name,
    normalize_project_statuses,
)


class _ProjectPayload(BaseModel):
    """Name and status-list normalization shared by the request payloads.

    ``check_fields=False`` because this base declares no fields itself.
    """

    @field_validator('name', mode='before', check_fields=False)
    @classmethod
    def trim_name(cls, value: object) -> object:
        if isinstance(value, str):
            value = normalize_project_name(value)
            if not value:
                raise ValueError('This field may not be blank.')
        return value

    @field_validator('project_statuses', mode='before', check_fields=False)
    @classmethod
    def normalize_statuses(cls, value: object) -> object:
        if not isinstance(value, (list, tuple)):
            return value
        statuses = normalize_project_statuses(value)
        if not statuses:
            raise ValueError('At least one status is required.')
        if len(statuses) > MAX_STATUSES:
            raise ValueError(
                f'A project may define at most {MAX_STATUSES} statuses.'
            )
        for status in statuses:
            if len(status) > MAX_STATUS_LENGTH:
                raise ValueError(
                    f'Statuses cannot exceed {MAX_STATUS_LENGTH} characters.'
                )
        return statuses

    @field_validator('terminal_status', mode='before', check_fields=False)
    @classmethod
    def normalize_terminal_status(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError('This field may not be blank.')
        return value

    @field_validator(
        'name',
        'description',
        'position',
        'project_statuses',
        'terminal_status',
        check_fields=False,
    )
    @classmethod
    def reject_null(cls, value: object) -> object:
        """An explicit ``null`` is not "leave it alone" — it is a 400."""
        if value is None:
            raise ValueError('This field may not be null.')
        return value


class ProjectRequest(_ProjectPayload):
    name: str = Field(min_length=1, max_length=100)
    description: str = ''
    position: int | None = None
    project_statuses: list[str] | None = None
    terminal_status: str | None = None


class PatchedProjectRequest(_ProjectPayload):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    position: int | None = None
    project_statuses: list[str] | None = None
    terminal_status: str | None = None


class ProjectResponse(BaseModel):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    name: str
    description: str
    is_inbox: bool = Field(..., json_schema_extra={'readOnly': True})
    position: int = Field(default=0, json_schema_extra={'readOnly': True})
    project_statuses: list[str] = Field(..., json_schema_extra={'readOnly': True})
    terminal_status: str = Field(..., json_schema_extra={'readOnly': True})
