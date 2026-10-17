"""Translate use-case errors into HTTP responses.

This is the only place that knows a :class:`WorkError` becomes a status code,
so the use cases stay transport-agnostic.
"""

from ninja import NinjaAPI

from apps.work.errors import NotFound, WorkError

STATUS_BY_CODE = {
    WorkError.code: 400,
    NotFound.code: 404,
}


def status_for(error: WorkError) -> int:
    return STATUS_BY_CODE.get(error.code, 400)


def register_error_handlers(api: NinjaAPI) -> None:
    @api.exception_handler(WorkError)
    def _handle_work_error(request, error: WorkError):
        return api.create_response(
            request,
            {'detail': error.message},
            status=status_for(error),
        )
