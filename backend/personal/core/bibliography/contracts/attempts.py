from datetime import date, datetime

from pydantic import ConfigDict, Field, field_validator

from personal.core.shared.base import BaseModel

from .items import AttemptOutcome


class _AttemptPayload(BaseModel):
    """``check_fields=False`` because this base declares no fields itself."""

    @field_validator('item', 'outcome', mode='before', check_fields=False)
    @classmethod
    def reject_null(cls, value: object) -> object:
        """An explicit ``null`` is not "leave it alone" — it is a validation error."""
        if value is None:
            raise ValueError('This field may not be null.')
        return value


class AttemptRequest(_AttemptPayload):
    """Start an Attempt (``in_progress``) or record one that has already ended.

    The end date is required once it has ended and must be empty while it is in
    progress; the use case checks that, together with the start date.
    """

    item: int
    outcome: AttemptOutcome
    started_on: date | None = None
    ended_on: date | None = None


class PatchedAttemptRequest(_AttemptPayload):
    """Finish, abandon or re-date an Attempt; it stays on its BibliographyItem."""

    model_config = ConfigDict(extra='forbid')

    outcome: AttemptOutcome | None = None
    started_on: date | None = None
    ended_on: date | None = None


class AttemptResponse(BaseModel):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    item_id: int = Field(..., json_schema_extra={'readOnly': True})
    outcome: AttemptOutcome
    started_on: date | None
    ended_on: date | None
    created_at: datetime = Field(..., json_schema_extra={'readOnly': True})
