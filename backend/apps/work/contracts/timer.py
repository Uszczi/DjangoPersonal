"""Timer contracts: request payload and the response shape."""

from datetime import datetime

from ninja import Schema
from pydantic import BaseModel

from .time_entries import TimeEntry


class TimerStartRequest(BaseModel):
    task: int


class TimerState(Schema):
    entry: TimeEntry | None = None
    server_now: datetime
