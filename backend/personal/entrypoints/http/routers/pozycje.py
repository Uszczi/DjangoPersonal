from fastapi import APIRouter, status

from personal.core.bibliografia import handlers
from personal.core.bibliografia.contracts import (
    PatchedPozycjaRequest,
    PozycjaRequest,
    PozycjaResponse,
)
from personal.entrypoints.http.deps import CurrentUser, PozycjaRepositoryDep

router = APIRouter(tags=['personal'])


@router.get('/pozycje/', operation_id='pozycje_list')
def list_pozycje(user: CurrentUser, pozycje: PozycjaRepositoryDep) -> list[PozycjaResponse]:
    return [
        PozycjaResponse.model_validate(pozycja)
        for pozycja in handlers.ListPozycje(pozycje, user).execute()
    ]


@router.post('/pozycje/', status_code=status.HTTP_201_CREATED, operation_id='pozycje_create')
def create_pozycja(
    payload: PozycjaRequest, user: CurrentUser, pozycje: PozycjaRepositoryDep
) -> PozycjaResponse:
    return PozycjaResponse.model_validate(handlers.CreatePozycja(pozycje, user).execute(payload))


@router.get('/pozycje/{id}/', operation_id='pozycje_retrieve')
def get_pozycja(id: int, user: CurrentUser, pozycje: PozycjaRepositoryDep) -> PozycjaResponse:
    return PozycjaResponse.model_validate(handlers.GetPozycja(pozycje, user).execute(id))


@router.patch('/pozycje/{id}/', operation_id='pozycje_partial_update')
def update_pozycja(
    id: int, payload: PatchedPozycjaRequest, user: CurrentUser, pozycje: PozycjaRepositoryDep
) -> PozycjaResponse:
    pozycja = handlers.UpdatePozycja(pozycje, user).execute(id, payload)
    return PozycjaResponse.model_validate(pozycja)
