from uuid import UUID

from pydantic import Field, field_validator

from personal.core.shared.base import BaseModel
from personal.core.shared.colors import HexColor
from personal.infra.rules import DEFAULT_TAG_COLOR, MAX_TAG_NAME_LENGTH, normalize_tag_name


class _TagPayload(BaseModel):
    """Name trimming shared by the create and the partial payloads.

    ``check_fields=False`` because this base declares no fields itself.
    """

    @field_validator('name', mode='before', check_fields=False)
    @classmethod
    def trim_name(cls, value: object) -> object:
        if isinstance(value, str):
            value = normalize_tag_name(value)
            if not value:
                raise ValueError('This field may not be blank.')
        return value

    @field_validator('name', 'color', mode='before', check_fields=False)
    @classmethod
    def reject_null(cls, value: object) -> object:
        """An explicit ``null`` is not "leave it alone" — it is a 400."""
        if value is None:
            raise ValueError('This field may not be null.')
        return value


class TagRequest(_TagPayload):
    name: str = Field(min_length=1, max_length=MAX_TAG_NAME_LENGTH)
    color: HexColor = DEFAULT_TAG_COLOR


class PatchedTagRequest(_TagPayload):
    name: str | None = Field(default=None, min_length=1, max_length=MAX_TAG_NAME_LENGTH)
    color: HexColor | None = None


class TagResponse(BaseModel):
    id: UUID = Field(..., json_schema_extra={'readOnly': True})
    name: str
    color: str
