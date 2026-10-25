from datetime import datetime
from typing import Any

from pydantic import Field, field_validator

from personal.core.shared.base import BaseModel


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
    kind: str = Field(default='whiteboard', pattern='^(whiteboard|markdown)$')
    name: str = Field(default='Bez tytułu', min_length=1, max_length=200)
    content: dict[str, Any] | None = None
    #: The Folder to create it in; without one it stays at the top level.
    folder_id: int | None = None


class PatchedWhiteboardRequest(_WhiteboardPayload):
    kind: str | None = Field(default=None, pattern='^(whiteboard|markdown)$')
    name: str | None = Field(default=None, min_length=1, max_length=200)
    content: dict[str, Any] | None = None
    #: Moves it to this Folder; an explicit ``null`` takes it out of its Folder.
    folder_id: int | None = None


class WhiteboardResponse(BaseModel):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    kind: str = Field(..., json_schema_extra={'readOnly': True})
    name: str
    content: dict[str, Any]
    folder_id: int | None = None
    created_at: datetime = Field(..., json_schema_extra={'readOnly': True})
    updated_at: datetime = Field(..., json_schema_extra={'readOnly': True})


class MatchingLine(BaseModel):
    """One line of a Notatka that matched a search, numbered from 1."""

    number: int
    text: str


class WhiteboardSearchResult(BaseModel):
    """A Whiteboard or Notatka found by a search: without its ``content``,
    with the lines of a Notatka's text that matched (empty when only the name did)."""

    id: int
    kind: str
    name: str
    folder_id: int | None = None
    created_at: datetime
    updated_at: datetime
    lines: list[MatchingLine]
