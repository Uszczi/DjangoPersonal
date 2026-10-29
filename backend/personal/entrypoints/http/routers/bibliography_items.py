from fastapi import APIRouter, status

from personal.core.bibliography import handlers
from personal.core.bibliography.contracts import (
    BibliographyItemRequest,
    BibliographyItemResponse,
    PatchedBibliographyItemRequest,
)
from personal.entrypoints.http.deps import (
    AttemptRepositoryDep,
    BibliographyItemRepositoryDep,
    CurrentUser,
)

router = APIRouter(tags=['personal'])


@router.get('/bibliography-items/', operation_id='bibliography_items_list')
def list_bibliography_items(
    user: CurrentUser, items: BibliographyItemRepositoryDep, attempts: AttemptRepositoryDep
) -> list[BibliographyItemResponse]:
    return [
        BibliographyItemResponse.model_validate(item)
        for item in handlers.ListBibliographyItems(items, attempts, user).execute()
    ]


@router.post(
    '/bibliography-items/',
    status_code=status.HTTP_201_CREATED,
    operation_id='bibliography_items_create',
)
def create_bibliography_item(
    payload: BibliographyItemRequest, user: CurrentUser, items: BibliographyItemRepositoryDep
) -> BibliographyItemResponse:
    item = handlers.CreateBibliographyItem(items, user).execute(payload)
    return BibliographyItemResponse.model_validate(item)


@router.get('/bibliography-items/{id}/', operation_id='bibliography_items_retrieve')
def get_bibliography_item(
    id: int,
    user: CurrentUser,
    items: BibliographyItemRepositoryDep,
    attempts: AttemptRepositoryDep,
) -> BibliographyItemResponse:
    item = handlers.GetBibliographyItem(items, attempts, user).execute(id)
    return BibliographyItemResponse.model_validate(item)


@router.patch('/bibliography-items/{id}/', operation_id='bibliography_items_partial_update')
def update_bibliography_item(
    id: int,
    payload: PatchedBibliographyItemRequest,
    user: CurrentUser,
    items: BibliographyItemRepositoryDep,
    attempts: AttemptRepositoryDep,
) -> BibliographyItemResponse:
    item = handlers.UpdateBibliographyItem(items, attempts, user).execute(id, payload)
    return BibliographyItemResponse.model_validate(item)
