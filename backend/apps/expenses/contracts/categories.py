"""Category contracts: request payloads and the response shape."""


from apps.shared.base import BaseModel
from pydantic import Field, field_validator

from apps.infra.models import normalize_category_name


class _CategoryPayload(BaseModel):
    """Name trimming shared by the create and the partial payloads.

    ``check_fields=False`` because this base declares no fields itself.
    """

    @field_validator('name', mode='before', check_fields=False)
    @classmethod
    def trim_name(cls, value: object) -> object:
        if isinstance(value, str):
            value = normalize_category_name(value)
            if not value:
                raise ValueError('This field may not be blank.')
        return value

    @field_validator('name', check_fields=False)
    @classmethod
    def reject_null(cls, value: object) -> object:
        """An explicit ``null`` is not "leave it alone" — it is a 400."""
        if value is None:
            raise ValueError('This field may not be null.')
        return value


class CategoryRequest(_CategoryPayload):
    name: str = Field(min_length=1, max_length=100)


class PatchedCategoryRequest(_CategoryPayload):
    name: str | None = Field(default=None, min_length=1, max_length=100)


class CategoryResponse(BaseModel):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    name: str
    is_system: bool = Field(default=False, json_schema_extra={'readOnly': True})
