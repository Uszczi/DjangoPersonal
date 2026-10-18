"""Timer contracts: request payload and the response shape."""
from datetime import datetime

from apps.shared.base import BaseModel

from .time_entries import TimeEntryResponse


class TimerStartRequest(BaseModel):
    task: int | None = None
    title: str = ''


class TimerResponse(BaseModel):
    entry: TimeEntryResponse | None = None
    server_now: datetime