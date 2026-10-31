from datetime import datetime

from pydantic import AwareDatetime, Field, field_validator

from personal.core.shared.base import BaseModel
from personal.core.shared.colors import HexColor
from personal.infra.rules import DEFAULT_COUNTER_COLOR


class _CounterPayload(BaseModel):
    """``check_fields=False`` because this base declares no fields itself."""

    @field_validator('color', mode='before', check_fields=False)
    @classmethod
    def reject_null_color(cls, value: object) -> object:
        """An explicit ``null`` is not "leave it alone" — it is a validation error."""
        if value is None:
            raise ValueError('This field may not be null.')
        return value

    @field_validator('name', mode='before', check_fields=False)
    @classmethod
    def trim_name(cls, value: object) -> object:
        if value is None:
            raise ValueError('This field may not be null.')
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError('This field may not be blank.')
        return value


class CounterRequest(_CounterPayload):
    name: str = Field(min_length=1, max_length=100)
    color: HexColor = DEFAULT_COUNTER_COLOR


class PatchedCounterRequest(_CounterPayload):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: HexColor | None = None


class CounterResponse(BaseModel):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    name: str
    color: str
    created_at: datetime = Field(..., json_schema_extra={'readOnly': True})
    entry_count: int = Field(..., json_schema_extra={'readOnly': True})
    total: int = Field(..., json_schema_extra={'readOnly': True})
    #: Days in a row with an entry, ending today or yesterday; 0 otherwise.
    streak_days: int = Field(..., json_schema_extra={'readOnly': True})
    #: Days since the day of the last entry; ``None`` with no entries.
    days_since_last_entry: int | None = Field(..., json_schema_extra={'readOnly': True})


class _CounterEntryPayload(BaseModel):
    @field_validator('value', 'occurred_at', 'note', 'counter', mode='before', check_fields=False)
    @classmethod
    def reject_null(cls, value: object) -> object:
        """An explicit ``null`` is not "leave it alone" — it is a validation error."""
        if value is None:
            raise ValueError('This field may not be null.')
        return value

    @field_validator('value', check_fields=False)
    @classmethod
    def reject_zero(cls, value: int) -> int:
        if value == 0:
            raise ValueError('Value may not be zero.')
        return value

    @field_validator('note', check_fields=False)
    @classmethod
    def trim_note(cls, value: str) -> str:
        return value.strip()


class CounterEntryRequest(_CounterEntryPayload):
    counter: int
    value: int = Field(default=1, ge=-1_000_000_000, le=1_000_000_000)
    #: The moment the entry happened; must carry a time zone (sent as ISO 8601).
    occurred_at: AwareDatetime
    note: str = Field(default='', max_length=1000)


class PatchedCounterEntryRequest(_CounterEntryPayload):
    value: int | None = Field(default=None, ge=-1_000_000_000, le=1_000_000_000)
    occurred_at: AwareDatetime | None = None
    note: str | None = Field(default=None, max_length=1000)


class CounterEntryResponse(BaseModel):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    counter_id: int = Field(..., json_schema_extra={'readOnly': True})
    value: int
    occurred_at: datetime
    note: str
