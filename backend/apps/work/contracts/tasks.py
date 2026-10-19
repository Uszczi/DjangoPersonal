"""Task contracts: request payloads and the response shape."""


from apps.shared.base import BaseModel
from pydantic import Field, field_validator


class _TaskPayload(BaseModel):
    """Title normalization shared by the create and the partial payloads.

    ``check_fields=False`` because this base declares no fields itself.
    """

    @field_validator('title', mode='before', check_fields=False)
    @classmethod
    def normalize_title(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError('This field may not be blank.')
            if value[0].islower():
                value = value[0].upper() + value[1:]
        return value

    @field_validator('title', 'description', 'project', 'is_completed', 'position', check_fields=False)
    @classmethod
    def reject_null(cls, value: object) -> object:
        """An explicit ``null`` is not "leave it alone" — it is a 400."""
        if value is None:
            raise ValueError('This field may not be null.')
        return value


class TaskCreateRequest(_TaskPayload):
    title: str = Field(min_length=1, max_length=200)
    description: str = ''
    project: int | None = None
    position: int | None = None


class PatchedTaskUpdateRequest(_TaskPayload):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    project: int | None = None
    is_completed: bool | None = None
    position: int | None = None


class TaskResponse(BaseModel):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    title: str
    description: str
    project_id: int = Field(..., json_schema_extra={'readOnly': True})
    is_completed: bool = Field(..., json_schema_extra={'readOnly': True})
    position: int = Field(default=0, json_schema_extra={'readOnly': True})

