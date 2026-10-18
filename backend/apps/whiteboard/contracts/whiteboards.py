"""Whiteboard contracts: request payloads and the response shape."""
from datetime import datetime
from typing import Any

from apps.shared.base import BaseModel
from pydantic import Field, field_validator


class _WhiteboardPayload(BaseModel):
    @field_validator('name', mode='before', check_fields=False)
    @classmethod
    def trim_name(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError('This field may not be blank.')
        return value


class WhiteboardRequest(_WhiteboardPayload):
    name: str = Field(default='Bez tytułu', min_length=1, max_length=200)
    content: dict[str, Any] | None = None


class PatchedWhiteboardRequest(_WhiteboardPayload):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    content: dict[str, Any] | None = None


class WhiteboardResponse(BaseModel):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    name: str
    content: dict[str, Any]
    created_at: datetime = Field(..., json_schema_extra={'readOnly': True})
    updated_at: datetime = Field(..., json_schema_extra={'readOnly': True})