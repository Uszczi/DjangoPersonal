"""Translate use-case errors into HTTP responses."""
from django.http import HttpRequest
from ninja import NinjaAPI

from apps.whiteboard.errors import NotFound, WhiteboardError

STATUS_BY_CODE = {
    WhiteboardError.code: 400,
    NotFound.code: 404,
}


def status_for(error: WhiteboardError) -> int:
    return STATUS_BY_CODE.get(error.code, 400)


def register_error_handlers(api: NinjaAPI) -> None:
    @api.exception_handler(WhiteboardError)
    def _handle_whiteboard_error(request: HttpRequest, error: WhiteboardError) -> object:
        return api.create_response(
            request,
            {'detail': error.message},
            status=status_for(error),
        )