from ninja import Router

from apps.infra.models import TimeEntry as TimeEntryModel
from apps.work import clock, deps, handlers
from apps.work.contracts import TimerStartRequest, TimerState

router = Router(tags=['personal'])


def _state(entry: TimeEntryModel | None) -> TimerState:
    """The timer response; ninja validates the ORM entry through ``TimeEntry``."""
    return TimerState(entry=entry, server_now=clock.now())  # type: ignore[arg-type]


@router.post(
    '/timer/start/',
    response=TimerState,
    operation_id='timer_start',
)
def start_timer(request, payload: TimerStartRequest):
    handler = handlers.StartTimer(
        tasks=deps.task_repository(),
        time_entries=deps.time_entry_repository(),
    )
    return _state(handler.execute(payload))


@router.get(
    '/timer/',
    response=TimerState,
    operation_id='timer_retrieve',
)
def get_timer(request):
    return _state(handlers.GetRunningEntry(deps.time_entry_repository()).execute())


@router.post(
    '/timer/stop/',
    response=TimerState,
    operation_id='timer_stop',
)
def stop_timer(request):
    handler = handlers.StopTimer(deps.time_entry_repository())
    return _state(handler.execute())
