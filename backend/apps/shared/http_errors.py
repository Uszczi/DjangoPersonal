"""Translate domain errors into HTTP responses.

This is the only place that knows a :class:`~apps.shared.errors.DomainError`
becomes a status code, so the use cases stay transport-agnostic.
"""


from django.http import HttpRequest
from ninja import NinjaAPI

from apps.shared.errors import DomainError, NotFound

STATUS_BY_CODE = {
    DomainError.code: 400,
    NotFound.code: 404,
}


def status_for(error: DomainError) -> int:
    if error.status is not None:
        return error.status
    return STATUS_BY_CODE.get(error.code, 400)


def register_error_handlers(api: NinjaAPI) -> None:
    @api.exception_handler(DomainError)
    def _handle_domain_error(request: HttpRequest, error: DomainError) -> object:
        return api.create_response(
            request,
            {'detail': error.message},
            status=status_for(error),
        )
