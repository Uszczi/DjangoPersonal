from datetime import datetime
from typing import Literal

from pydantic import ConfigDict, Field, field_validator

from personal.core.shared.base import BaseModel

ItemKind = Literal['film', 'book']

#: Where a BibliographyItem stands; never sent by a client, always derived.
#: ``planned`` means to watch or to read: no Attempt yet.
ItemStatus = Literal['planned', 'in_progress', 'finished', 'abandoned']

#: How an Attempt stands: still going, or ended one way or the other.
AttemptOutcome = Literal['in_progress', 'finished', 'abandoned']


class _BibliographyItemPayload(BaseModel):
    """``check_fields=False`` because this base declares no fields itself."""

    @field_validator('kind', 'title', 'creator', 'note', mode='before', check_fields=False)
    @classmethod
    def reject_null(cls, value: object) -> object:
        """An explicit ``null`` is not "leave it alone" — it is a validation error."""
        if value is None:
            raise ValueError('This field may not be null.')
        return value

    @field_validator('title', mode='before', check_fields=False)
    @classmethod
    def trim_title(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError('This field may not be blank.')
        return value

    @field_validator('creator', 'note', check_fields=False)
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()


class BibliographyItemRequest(_BibliographyItemPayload):
    kind: ItemKind
    title: str = Field(min_length=1, max_length=300)
    creator: str = Field(default='', max_length=200)
    year: int | None = Field(default=None, gt=0, le=9999)
    #: Pages for a book, minutes for a film.
    length: int | None = Field(default=None, gt=0, le=1_000_000)
    note: str = Field(default='', max_length=10_000)


class PatchedBibliographyItemRequest(_BibliographyItemPayload):
    """The kind is fixed at creation, so it is not a field here: sending it is an error."""

    model_config = ConfigDict(extra='forbid')

    title: str | None = Field(default=None, min_length=1, max_length=300)
    creator: str | None = Field(default=None, max_length=200)
    year: int | None = Field(default=None, gt=0, le=9999)
    length: int | None = Field(default=None, gt=0, le=1_000_000)
    note: str | None = Field(default=None, max_length=10_000)


class BibliographyItemResponse(BaseModel):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    kind: ItemKind
    title: str
    creator: str
    year: int | None
    length: int | None
    note: str
    status: ItemStatus = Field(..., json_schema_extra={'readOnly': True})
    created_at: datetime = Field(..., json_schema_extra={'readOnly': True})
