from django.http import HttpRequest
from typing import cast
from ninja import Router, Status
from ninja_jwt.authentication import JWTAuth

from apps.infra.models import User
from apps.infra.models import Whiteboard as WhiteboardModel
from apps.whiteboard import deps, handlers
from apps.whiteboard.contracts import (
    PatchedWhiteboardRequest,
    WhiteboardRequest,
    WhiteboardResponse,
)

router = Router(tags=['personal'])


@router.get(
    '/whiteboards/',
    response=list[WhiteboardResponse],
    auth=JWTAuth(),
    operation_id='whiteboards_list',
)
def list_whiteboards(request: HttpRequest) -> list[WhiteboardModel]:
    return handlers.ListWhiteboards(deps.whiteboard_repository(), cast(User, request.user)).execute()


@router.post(
    '/whiteboards/',
    response={201: WhiteboardResponse},
    auth=JWTAuth(),
    operation_id='whiteboards_create',
)
def create_whiteboard(request: HttpRequest, payload: WhiteboardRequest) -> Status[WhiteboardModel]:
    handler = handlers.CreateWhiteboard(deps.whiteboard_repository(), cast(User, request.user))
    return Status(201, handler.execute(payload))


@router.get(
    '/whiteboards/{id}/',
    response=WhiteboardResponse,
    auth=JWTAuth(),
    operation_id='whiteboards_retrieve',
)
def get_whiteboard(request: HttpRequest, id: int) -> WhiteboardModel:
    return handlers.GetWhiteboard(deps.whiteboard_repository(), cast(User, request.user)).execute(id)


@router.patch(
    '/whiteboards/{id}/',
    response=WhiteboardResponse,
    auth=JWTAuth(),
    operation_id='whiteboards_partial_update',
)
def update_whiteboard(request: HttpRequest, id: int, payload: PatchedWhiteboardRequest) -> WhiteboardModel:
    handler = handlers.UpdateWhiteboard(deps.whiteboard_repository(), cast(User, request.user))
    return handler.execute(id, payload)


@router.delete(
    '/whiteboards/{id}/',
    response={204: None},
    auth=JWTAuth(),
    operation_id='whiteboards_destroy',
)
def delete_whiteboard(request: HttpRequest, id: int) -> Status[None]:
    handlers.DeleteWhiteboard(deps.whiteboard_repository(), cast(User, request.user)).execute(id)
    return Status(204, None)