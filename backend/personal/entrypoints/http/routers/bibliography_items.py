from fastapi import APIRouter, Response, status

from personal.core.bibliography import handlers
from personal.core.bibliography.contracts import (
    BibliographyItemRequest,
    BibliographyItemResponse,
    ItemKind,
    ItemStatus,
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
    user: CurrentUser,
    items: BibliographyItemRepositoryDep,
    attempts: AttemptRepositoryDep,
    status: ItemStatus | None = None,
    kind: ItemKind | None = None,
) -> list[BibliographyItemResponse]:
    listed = handlers.ListBibliographyItems(items, attempts, user).execute(
        status=status, kind=kind
    )
    return [BibliographyItemResponse.from_item(entry.item, entry.status) for entry in listed]


@router.post(
    '/bibliography-items/',
    status_code=status.HTTP_201_CREATED,
    operation_id='bibliography_items_create',
)
def create_bibliography_item(
    payload: BibliographyItemRequest, user: CurrentUser, items: BibliographyItemRepositoryDep
) -> BibliographyItemResponse:
    created = handlers.CreateBibliographyItem(items, user).execute(payload)
    return BibliographyItemResponse.from_item(created.item, created.status)


@router.get('/bibliography-items/{id}/', operation_id='bibliography_items_retrieve')
def get_bibliography_item(
    id: int,
    user: CurrentUser,
    items: BibliographyItemRepositoryDep,
    attempts: AttemptRepositoryDep,
) -> BibliographyItemResponse:
    found = handlers.GetBibliographyItem(items, attempts, user).execute(id)
    return BibliographyItemResponse.from_item(found.item, found.status)


@router.patch('/bibliography-items/{id}/', operation_id='bibliography_items_partial_update')
def update_bibliography_item(
    id: int,
    payload: PatchedBibliographyItemRequest,
    user: CurrentUser,
    items: BibliographyItemRepositoryDep,
    attempts: AttemptRepositoryDep,
) -> BibliographyItemResponse:
    updated = handlers.UpdateBibliographyItem(items, attempts, user).execute(id, payload)
    return BibliographyItemResponse.from_item(updated.item, updated.status)


@router.delete(
    '/bibliography-items/{id}/',
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id='bibliography_items_destroy',
)
def delete_bibliography_item(
    id: int, user: CurrentUser, items: BibliographyItemRepositoryDep
) -> None:
    handlers.DeleteBibliographyItem(items, user).execute(id)
