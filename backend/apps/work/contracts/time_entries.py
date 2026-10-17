"""Time entry contracts: request payloads and the response shape."""

from datetime import date as datetime_date, datetime
from typing import Any

from ninja import Schema
from pydantic import BaseModel, Field

MAX_ENTRY_DURATION_MINUTES = 24 * 60


class TimeEntryCreateRequest(BaseModel):
    task: int
    date: datetime_date
    duration_minutes: int = Field(ge=1, le=MAX_ENTRY_DURATION_MINUTES)


class PatchedTimeEntryRequest(BaseModel):
    task: int | None = None
    date: datetime_date | None = None
    duration_minutes: int | None = Field(
        default=None, ge=1, le=MAX_ENTRY_DURATION_MINUTES
    )


class TimeEntry(Schema):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    task: int = Field(..., json_schema_extra={'readOnly': True})
    start: datetime
    end: datetime | None = None

    @staticmethod
    def resolve_task(obj: Any) -> int:
        return int(obj.task_id)