from django.http import HttpRequest
from typing import cast
from ninja import Router
from ninja_jwt.authentication import JWTAuth

from apps.infra.models import TimeEntry as TimeEntryModel
from apps.infra.models import User
from apps.work import clock, deps, handlers
from apps.work.contracts import TimerResponse, TimerStartRequest

router = Router(tags=['personal'])


def _state(entry: TimeEntryModel | None) -> TimerResponse:
    """The timer response; ninja validates the ORM entry through ``TimeEntry``."""
    return TimerResponse(entry=entry, server_now=clock.now())  # type: ignore[arg-type]


@router.post(
    '/timer/start/',
    response=TimerResponse,
    auth=JWTAuth(),
    operation_id='timer_start',
)
def start_timer(request: HttpRequest, payload: TimerStartRequest) -> TimerResponse:
    handler = handlers.StartTimer(
        tasks=deps.task_repository(),
        time_entries=deps.time_entry_repository(),
        user=cast(User, request.user),
    )
    return _state(handler.execute(payload))


@router.get(
    '/timer/',
    response=TimerResponse,
    auth=JWTAuth(),
    operation_id='timer_retrieve',
)
def get_timer(request: HttpRequest) -> TimerResponse:
    return _state(handlers.GetRunningEntry(deps.time_entry_repository(), cast(User, request.user)).execute())


@router.post(
    '/timer/stop/',
    response=TimerResponse,
    auth=JWTAuth(),
    operation_id='timer_stop',
)
def stop_timer(request: HttpRequest) -> TimerResponse:
    handler = handlers.StopTimer(deps.time_entry_repository(), cast(User, request.user))
    return _state(handler.execute())