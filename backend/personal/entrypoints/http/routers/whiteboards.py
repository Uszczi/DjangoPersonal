"""Whiteboard endpoints: boards and Notatki alike (``kind``)."""

from fastapi import APIRouter, Response, status

from personal.core.whiteboard import handlers
from personal.core.whiteboard.contracts import (
    PatchedWhiteboardRequest,
    WhiteboardRequest,
    WhiteboardResponse,
)
from personal.entrypoints.http.deps import (
    CurrentUser,
    FolderRepositoryDep,
    WhiteboardRepositoryDep,
)

router = APIRouter(tags=['personal'])


@router.get('/whiteboards/', operation_id='whiteboards_list')
def list_whiteboards(
    user: CurrentUser, whiteboards: WhiteboardRepositoryDep
) -> list[WhiteboardResponse]:
    return [
        WhiteboardResponse.model_validate(whiteboard)
        for whiteboard in handlers.ListWhiteboards(whiteboards, user).execute()
    ]


@router.post(
    '/whiteboards/',
    status_code=status.HTTP_201_CREATED,
    operation_id='whiteboards_create',
)
def create_whiteboard(
    payload: WhiteboardRequest,
    user: CurrentUser,
    whiteboards: WhiteboardRepositoryDep,
    folders: FolderRepositoryDep,
) -> WhiteboardResponse:
    whiteboard = handlers.CreateWhiteboard(whiteboards, folders, user).execute(payload)
    return WhiteboardResponse.model_validate(whiteboard)


@router.get('/whiteboards/{id}/', operation_id='whiteboards_retrieve')
def get_whiteboard(
    id: int, user: CurrentUser, whiteboards: WhiteboardRepositoryDep
) -> WhiteboardResponse:
    return WhiteboardResponse.model_validate(handlers.GetWhiteboard(whiteboards, user).execute(id))


@router.patch('/whiteboards/{id}/', operation_id='whiteboards_partial_update')
def update_whiteboard(
    id: int,
    payload: PatchedWhiteboardRequest,
    user: CurrentUser,
    whiteboards: WhiteboardRepositoryDep,
    folders: FolderRepositoryDep,
) -> WhiteboardResponse:
    whiteboard = handlers.UpdateWhiteboard(whiteboards, folders, user).execute(id, payload)
    return WhiteboardResponse.model_validate(whiteboard)


@router.delete(
    '/whiteboards/{id}/',
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id='whiteboards_destroy',
)
def delete_whiteboard(id: int, user: CurrentUser, whiteboards: WhiteboardRepositoryDep) -> None:
    handlers.DeleteWhiteboard(whiteboards, user).execute(id)
