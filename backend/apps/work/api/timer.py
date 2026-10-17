from ninja import Router

from apps.work import clock, handlers
from apps.work.contracts import TimerStartRequest, TimerState

router = Router(tags=['personal'])


@router.post(
    '/timer/start/',
    response=TimerState,
    operation_id='timer_start',
)
def start_timer(request, payload: TimerStartRequest):
    entry = handlers.start_timer(payload)
    return TimerState(entry=entry, server_now=clock.now())


@router.get(
    '/timer/',
    response=TimerState,
    operation_id='timer_retrieve',
)
def get_timer(request):
    return TimerState(entry=handlers.get_running_entry(), server_now=clock.now())


@router.post(
    '/timer/stop/',
    response=TimerState,
    operation_id='timer_stop',
)
def stop_timer(request):
    entry = handlers.stop_timer()
    return TimerState(entry=entry, server_now=clock.now())
