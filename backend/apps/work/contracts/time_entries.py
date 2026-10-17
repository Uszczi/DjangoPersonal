"""Time entry contracts: request payloads and the response shape."""

from datetime import date as datetime_date, datetime

from ninja import Schema
from pydantic import BaseModel, Field

MAX_ENTRY_DURATION_MINUTES = 24 * 60


class TimeEntryCreateRequest(BaseModel):
    task: int
    date: datetime_date
    duration_minutes: int = Field(ge=1, le=MAX_ENTRY_DURATION_MINUTES)


class PatchedTimeEntryRequest(BaseModel):
    task: int = None
    date: datetime_date = None
    duration_minutes: int = Field(
        default=None, ge=1, le=MAX_ENTRY_DURATION_MINUTES
    )


class TimeEntry(Schema):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    task: int = Field(..., json_schema_extra={'readOnly': True})
    start: datetime
    end: datetime | None = None

    @staticmethod
    def resolve_task(obj):
        return obj.task_id
