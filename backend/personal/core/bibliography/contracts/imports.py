from datetime import date
from typing import Literal

from pydantic import Field

from personal.core.shared.base import BaseModel

from .items import BibliographyItemRequest

#: Most items one import may carry: room for years of history in one call.
MAX_IMPORTED_ITEMS = 2000


class ImportedAttempt(BaseModel):
    """An Attempt that ended in the past; an import records history, nothing in progress."""

    outcome: Literal['finished', 'abandoned'] = 'finished'
    started_on: date | None = None
    ended_on: date


class ImportedBibliographyItem(BibliographyItemRequest):
    """A BibliographyItem together with the Attempts already made at it."""

    attempts: list[ImportedAttempt] = Field(default_factory=list)


class BibliographyImportRequest(BaseModel):
    items: list[ImportedBibliographyItem] = Field(min_length=1, max_length=MAX_IMPORTED_ITEMS)


class BibliographyImportResponse(BaseModel):
    items_created: int
    attempts_recorded: int
