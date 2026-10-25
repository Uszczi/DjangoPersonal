from datetime import datetime

from pydantic import Field, field_validator

from personal.core.shared.base import BaseModel
from personal.infra.rules import normalize_folder_name


class _FolderPayload(BaseModel):
    """Name rules shared by the create and the partial payloads.

    ``check_fields=False`` because this base declares no fields itself.
    """

    @field_validator('name', mode='before', check_fields=False)
    @classmethod
    def trim_name(cls, value: object) -> object:
        if value is None:
            raise ValueError('This field may not be null.')
        if isinstance(value, str):
            value = normalize_folder_name(value)
            if not value:
                raise ValueError('This field may not be blank.')
        return value


class FolderRequest(_FolderPayload):
    name: str = Field(min_length=1, max_length=100)


class PatchedFolderRequest(_FolderPayload):
    name: str | None = Field(default=None, min_length=1, max_length=100)


class FolderResponse(BaseModel):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    name: str
    created_at: datetime = Field(..., json_schema_extra={'readOnly': True})
