from uuid import UUID

from pydantic import Field, field_validator

from personal.core.shared.base import BaseModel
from personal.infra.rules import MAX_TASK_TITLE_LENGTH


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

    @field_validator('status', mode='before', check_fields=False)
    @classmethod
    def normalize_status(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError('This field may not be blank.')
        return value

    @field_validator(
        'title', 'description', 'project', 'status', 'position', 'tags', check_fields=False
    )
    @classmethod
    def reject_null(cls, value: object) -> object:
        """An explicit ``null`` is not "leave it alone" — it is a 400."""
        if value is None:
            raise ValueError('This field may not be null.')
        return value


class TaskCreateRequest(_TaskPayload):
    title: str = Field(min_length=1, max_length=MAX_TASK_TITLE_LENGTH)
    description: str = ''
    project: UUID | None = None
    status: str | None = None
    position: int | None = None
    #: The ids of the user's Tags to put on the Task.
    tags: list[UUID] = Field(default_factory=list)


class PatchedTaskUpdateRequest(_TaskPayload):
    title: str | None = Field(default=None, min_length=1, max_length=MAX_TASK_TITLE_LENGTH)
    description: str | None = None
    project: UUID | None = None
    status: str | None = None
    position: int | None = None
    #: Replaces the Task's Tags: every id given, and only those.
    tags: list[UUID] | None = None


class TaskResponse(BaseModel):
    id: UUID = Field(..., json_schema_extra={'readOnly': True})
    title: str
    description: str
    project_id: UUID = Field(..., json_schema_extra={'readOnly': True})
    status: str = Field(..., json_schema_extra={'readOnly': True})
    position: int = Field(default=0, json_schema_extra={'readOnly': True})
    comment_count: int = Field(default=0, json_schema_extra={'readOnly': True})
    #: The ids of the Task's Tags, alphabetically by name.
    tags: list[UUID] = Field(default_factory=list)

    @field_validator('tags', mode='before')
    @classmethod
    def tag_ids(cls, value: object) -> object:
        """Read off the ORM, ``tags`` holds the Tag rows; the response carries their ids."""
        if isinstance(value, list):
            return [getattr(tag, 'id', tag) for tag in value]
        return value
