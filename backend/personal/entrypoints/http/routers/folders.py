"""Folder endpoints: the single-level groups of the Notatnik."""

from fastapi import APIRouter, Response, status

from personal.core.whiteboard import handlers
from personal.core.whiteboard.contracts import (
    FolderRequest,
    FolderResponse,
    PatchedFolderRequest,
)
from personal.entrypoints.http.deps import CurrentUser, FolderRepositoryDep

router = APIRouter(tags=['personal'])


@router.get('/folders/', operation_id='folders_list')
def list_folders(user: CurrentUser, folders: FolderRepositoryDep) -> list[FolderResponse]:
    return [
        FolderResponse.model_validate(folder)
        for folder in handlers.ListFolders(folders, user).execute()
    ]


@router.post(
    '/folders/',
    status_code=status.HTTP_201_CREATED,
    operation_id='folders_create',
)
def create_folder(
    payload: FolderRequest, user: CurrentUser, folders: FolderRepositoryDep
) -> FolderResponse:
    return FolderResponse.model_validate(handlers.CreateFolder(folders, user).execute(payload))


@router.patch('/folders/{id}/', operation_id='folders_partial_update')
def update_folder(
    id: int, payload: PatchedFolderRequest, user: CurrentUser, folders: FolderRepositoryDep
) -> FolderResponse:
    return FolderResponse.model_validate(
        handlers.UpdateFolder(folders, user).execute(id, payload)
    )


@router.delete(
    '/folders/{id}/',
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id='folders_destroy',
)
def delete_folder(id: int, user: CurrentUser, folders: FolderRepositoryDep) -> None:
    handlers.DeleteFolder(folders, user).execute(id)
