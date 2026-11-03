from datetime import date as datetime_date
from datetime import datetime

from pydantic import Field, field_validator

from personal.core.shared.base import BaseModel

MAX_ENTRY_DURATION_MINUTES = 24 * 60


class TimeEntryCreateRequest(BaseModel):
    task: int | None = None
    title: str = ''
    date: datetime_date
    duration_minutes: int = Field(ge=1, le=MAX_ENTRY_DURATION_MINUTES)


class PatchedTimeEntryRequest(BaseModel):
    task: int | None = None
    title: str | None = None
    date: datetime_date | None = None
    duration_minutes: int | None = Field(
        default=None, ge=1, le=MAX_ENTRY_DURATION_MINUTES
    )

    @field_validator('title', 'date', 'duration_minutes')
    @classmethod
    def reject_null(cls, value: object) -> object:
        """An explicit ``null`` is not "leave it alone"; only ``task`` may be cleared."""
        if value is None:
            raise ValueError('This field may not be null.')
        return value


class TimeEntryResponse(BaseModel):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    task_id: int | None = Field(..., json_schema_extra={'readOnly': True})
    title: str = Field(..., json_schema_extra={'readOnly': True})
    start: datetime
    end: datetime | None = None
    planned_end: datetime | None = Field(default=None, json_schema_extra={'readOnly': True})

class TimeEntryTitleResponse(BaseModel):
    """A title past entries were recorded under, offered when naming a new one."""

    title: str = Field(..., json_schema_extra={'readOnly': True})
    #: When an entry under this title last started.
    last_used: datetime = Field(..., json_schema_extra={'readOnly': True})
