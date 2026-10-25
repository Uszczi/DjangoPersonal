from datetime import datetime

from pydantic import Field

from personal.core.shared.base import BaseModel

from .time_entries import MAX_ENTRY_DURATION_MINUTES, TimeEntryResponse


class TimerStartRequest(BaseModel):
    task: int | None = None
    title: str = ''
    #: Stop the timer by itself after this many minutes; omitted runs until stopped.
    duration_minutes: int | None = Field(default=None, ge=1, le=MAX_ENTRY_DURATION_MINUTES)


class TimerResponse(BaseModel):
    entry: TimeEntryResponse | None = None
    server_now: datetime