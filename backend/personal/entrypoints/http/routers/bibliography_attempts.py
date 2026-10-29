from fastapi import APIRouter, Response, status

from personal.core.bibliography import handlers
from personal.core.bibliography.contracts import (
    AttemptRequest,
    AttemptResponse,
    PatchedAttemptRequest,
)
from personal.entrypoints.http.deps import (
    AttemptRepositoryDep,
    BibliographyItemRepositoryDep,
    CurrentUser,
)

router = APIRouter(tags=['personal'])


@router.get('/bibliography-attempts/', operation_id='bibliography_attempts_list')
def list_attempts(
    item: int,
    user: CurrentUser,
    attempts: AttemptRepositoryDep,
    items: BibliographyItemRepositoryDep,
) -> list[AttemptResponse]:
    found = handlers.ListAttempts(attempts, items, user).execute(item)
    return [AttemptResponse.model_validate(attempt) for attempt in found]


@router.post(
    '/bibliography-attempts/',
    status_code=status.HTTP_201_CREATED,
    operation_id='bibliography_attempts_create',
)
def create_attempt(
    payload: AttemptRequest,
    user: CurrentUser,
    attempts: AttemptRepositoryDep,
    items: BibliographyItemRepositoryDep,
) -> AttemptResponse:
    attempt = handlers.CreateAttempt(attempts, items, user).execute(payload)
    return AttemptResponse.model_validate(attempt)


@router.get('/bibliography-attempts/{id}/', operation_id='bibliography_attempts_retrieve')
def get_attempt(
    id: int, user: CurrentUser, attempts: AttemptRepositoryDep
) -> AttemptResponse:
    return AttemptResponse.model_validate(handlers.GetAttempt(attempts, user).execute(id))


@router.patch('/bibliography-attempts/{id}/', operation_id='bibliography_attempts_partial_update')
def update_attempt(
    id: int,
    payload: PatchedAttemptRequest,
    user: CurrentUser,
    attempts: AttemptRepositoryDep,
) -> AttemptResponse:
    attempt = handlers.UpdateAttempt(attempts, user).execute(id, payload)
    return AttemptResponse.model_validate(attempt)


@router.delete(
    '/bibliography-attempts/{id}/',
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id='bibliography_attempts_destroy',
)
def delete_attempt(id: int, user: CurrentUser, attempts: AttemptRepositoryDep) -> None:
    handlers.DeleteAttempt(attempts, user).execute(id)
