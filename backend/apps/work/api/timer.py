"""Timer endpoints: the single running time entry."""

from fastapi import APIRouter

from apps.accounts.deps import CurrentUser
from apps.infra.models import TimeEntry as TimeEntryModel
from apps.work import clock, handlers
from apps.work.contracts import TimeEntryResponse, TimerResponse, TimerStartRequest
from apps.work.deps import TaskRepositoryDep, TimeEntryRepositoryDep

router = APIRouter(tags=['personal'])


def _state(entry: TimeEntryModel | None) -> TimerResponse:
    """The timer response: the running entry (if any) and the server's clock."""
    return TimerResponse(
        entry=None if entry is None else TimeEntryResponse.model_validate(entry),
        server_now=clock.now(),
    )


@router.post('/timer/start/', operation_id='timer_start')
def start_timer(
    payload: TimerStartRequest,
    user: CurrentUser,
    tasks: TaskRepositoryDep,
    time_entries: TimeEntryRepositoryDep,
) -> TimerResponse:
    handler = handlers.StartTimer(tasks=tasks, time_entries=time_entries, user=user)
    return _state(handler.execute(payload))


@router.get('/timer/', operation_id='timer_retrieve')
def get_timer(user: CurrentUser, time_entries: TimeEntryRepositoryDep) -> TimerResponse:
    return _state(handlers.GetRunningEntry(time_entries, user).execute())


@router.post('/timer/stop/', operation_id='timer_stop')
def stop_timer(user: CurrentUser, time_entries: TimeEntryRepositoryDep) -> TimerResponse:
    return _state(handlers.StopTimer(time_entries, user).execute())
