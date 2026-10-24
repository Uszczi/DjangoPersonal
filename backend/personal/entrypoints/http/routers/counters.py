from fastapi import APIRouter, Response, status

from personal.core.counters import handlers
from personal.core.counters.contracts import (
    CounterEntryRequest,
    CounterEntryResponse,
    CounterRequest,
    CounterResponse,
    PatchedCounterEntryRequest,
    PatchedCounterRequest,
)
from personal.entrypoints.http.deps import (
    CounterEntryRepositoryDep,
    CounterRepositoryDep,
    CurrentUser,
)

router = APIRouter(tags=['personal'])


@router.get('/counters/', operation_id='counters_list')
def list_counters(user: CurrentUser, counters: CounterRepositoryDep) -> list[CounterResponse]:
    return [
        CounterResponse.model_validate(counter)
        for counter in handlers.ListCounters(counters, user).execute()
    ]


@router.post('/counters/', status_code=status.HTTP_201_CREATED, operation_id='counters_create')
def create_counter(
    payload: CounterRequest, user: CurrentUser, counters: CounterRepositoryDep
) -> CounterResponse:
    return CounterResponse.model_validate(handlers.CreateCounter(counters, user).execute(payload))


@router.get('/counters/{id}/', operation_id='counters_retrieve')
def get_counter(id: int, user: CurrentUser, counters: CounterRepositoryDep) -> CounterResponse:
    return CounterResponse.model_validate(handlers.GetCounter(counters, user).execute(id))


@router.patch('/counters/{id}/', operation_id='counters_partial_update')
def update_counter(
    id: int, payload: PatchedCounterRequest, user: CurrentUser, counters: CounterRepositoryDep
) -> CounterResponse:
    counter = handlers.UpdateCounter(counters, user).execute(id, payload)
    return CounterResponse.model_validate(counter)


@router.delete(
    '/counters/{id}/',
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id='counters_destroy',
)
def delete_counter(id: int, user: CurrentUser, counters: CounterRepositoryDep) -> None:
    handlers.DeleteCounter(counters, user).execute(id)


@router.get('/counter-entries/', operation_id='counter_entries_list')
def list_counter_entries(
    counter: int,
    user: CurrentUser,
    entries: CounterEntryRepositoryDep,
    counters: CounterRepositoryDep,
) -> list[CounterEntryResponse]:
    found = handlers.ListCounterEntries(entries, counters, user).execute(counter)
    return [CounterEntryResponse.model_validate(entry) for entry in found]


@router.post(
    '/counter-entries/',
    status_code=status.HTTP_201_CREATED,
    operation_id='counter_entries_create',
)
def create_counter_entry(
    payload: CounterEntryRequest,
    user: CurrentUser,
    entries: CounterEntryRepositoryDep,
    counters: CounterRepositoryDep,
) -> CounterEntryResponse:
    entry = handlers.CreateCounterEntry(entries, counters, user).execute(payload)
    return CounterEntryResponse.model_validate(entry)


@router.get('/counter-entries/{id}/', operation_id='counter_entries_retrieve')
def get_counter_entry(
    id: int, user: CurrentUser, entries: CounterEntryRepositoryDep
) -> CounterEntryResponse:
    return CounterEntryResponse.model_validate(handlers.GetCounterEntry(entries, user).execute(id))


@router.patch('/counter-entries/{id}/', operation_id='counter_entries_partial_update')
def update_counter_entry(
    id: int,
    payload: PatchedCounterEntryRequest,
    user: CurrentUser,
    entries: CounterEntryRepositoryDep,
) -> CounterEntryResponse:
    entry = handlers.UpdateCounterEntry(entries, user).execute(id, payload)
    return CounterEntryResponse.model_validate(entry)


@router.delete(
    '/counter-entries/{id}/',
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id='counter_entries_destroy',
)
def delete_counter_entry(id: int, user: CurrentUser, entries: CounterEntryRepositoryDep) -> None:
    handlers.DeleteCounterEntry(entries, user).execute(id)
