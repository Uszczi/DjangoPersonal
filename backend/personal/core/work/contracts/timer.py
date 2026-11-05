from datetime import datetime
from uuid import UUID

from pydantic import AwareDatetime, Field

from personal.core.shared.base import BaseModel

from .time_entries import MAX_ENTRY_DURATION_MINUTES, TimeEntryResponse


class TimerStartRequest(BaseModel):
    #: The new entry's id, chosen by the client so a Start queued offline can
    #: be referred to (stopped, discarded) before the server has seen it.
    id: UUID | None = None
    task: UUID | None = None
    title: str = ''
    #: Stop the timer by itself after this many minutes; omitted runs until stopped.
    duration_minutes: int | None = Field(default=None, ge=1, le=MAX_ENTRY_DURATION_MINUTES)
    #: When the user pressed Start, for a Start sent later (offline); omitted means now.
    at: AwareDatetime | None = None


class TimerStopRequest(BaseModel):
    #: The entry the client means to stop. If it has already ended (its limit
    #: ran out, or another device stopped or replaced it), stopping is a no-op.
    entry: UUID | None = None
    #: When the user pressed Stop, for a Stop sent later (offline); omitted means now.
    at: AwareDatetime | None = None


class TimerResponse(BaseModel):
    entry: TimeEntryResponse | None = None
    server_now: datetime
