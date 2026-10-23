"""Translate domain errors into HTTP responses.

This is the only place that knows a :class:`~apps.shared.errors.DomainError`
becomes a status code, so the use cases stay transport-agnostic.

It serves both HTTP apps during the FastAPI migration: Django Ninja through
:func:`register_error_handlers`, FastAPI through
:func:`register_fastapi_error_handlers`. The FastAPI handlers also reproduce
Ninja's request-validation responses, which are part of the API contract.
Django and Ninja are imported for type checking only, so the FastAPI app can
import this module without configuring Django.
"""

from collections.abc import Sequence
from typing import TYPE_CHECKING, Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from apps.shared.errors import DomainError, NotFound

if TYPE_CHECKING:
    from django.http import HttpRequest
    from ninja import NinjaAPI

STATUS_BY_CODE = {
    DomainError.code: 400,
    NotFound.code: 404,
}

UNPARSABLE_BODY_DETAIL = 'Cannot parse request body'


def status_for(error: DomainError) -> int:
    if error.status is not None:
        return error.status
    return STATUS_BY_CODE.get(error.code, 400)


def register_error_handlers(api: 'NinjaAPI') -> None:
    @api.exception_handler(DomainError)
    def _handle_domain_error(request: 'HttpRequest', error: DomainError) -> object:
        return api.create_response(
            request,
            {'detail': error.message},
            status=status_for(error),
        )


def register_fastapi_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DomainError, _handle_domain_error)
    app.add_exception_handler(RequestValidationError, _handle_validation_error)


async def _handle_domain_error(request: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, DomainError)
    return JSONResponse({'detail': error.message}, status_code=status_for(error))


async def _handle_validation_error(request: Request, error: Exception) -> JSONResponse:
    """Answer the way Django Ninja does.

    - malformed JSON is a 400 with a plain message, not a validation error;
    - every other error is a 422 listing ``type``/``loc``/``msg`` (+ ``ctx``),
      without the ``input``/``url`` keys FastAPI adds;
    - a body error is located under the body parameter's name
      (``['body', 'payload', 'name']``), which FastAPI omits for a single body.
    """
    assert isinstance(error, RequestValidationError)
    errors: Sequence[Any] = error.errors()
    if any(item.get('type') == 'json_invalid' for item in errors):
        return JSONResponse({'detail': UNPARSABLE_BODY_DETAIL}, status_code=400)

    body_name = _unembedded_body_name(request)
    detail = [_ninja_error(item, body_name) for item in errors]
    return JSONResponse({'detail': detail}, status_code=422)


def _unembedded_body_name(request: Request) -> str | None:
    """The body parameter name FastAPI leaves out of ``loc``, if any.

    A lone body model is read from the top level of the request, so FastAPI
    reports its errors as ``('body', <field>)``. Several (or ``embed=True``)
    bodies are already nested under their names.
    """
    route = request.scope.get('route')
    if not isinstance(route, APIRoute) or route.body_field is None:
        return None
    if getattr(route, '_embed_body_fields', False):
        return None
    return route.body_field.name


def _ninja_error(item: Any, body_name: str | None) -> dict[str, Any]:
    loc = list(item['loc'])
    if body_name is not None and loc[:1] == ['body']:
        loc.insert(1, body_name)
    shaped: dict[str, Any] = {'type': item['type'], 'loc': loc, 'msg': item['msg']}
    if 'ctx' in item:
        shaped['ctx'] = {key: _json_scalar(value) for key, value in item['ctx'].items()}
    return shaped


def _json_scalar(value: object) -> object:
    # ``ctx`` may hold the raised exception (``{'error': ValueError(...)}``);
    # Ninja serializes it as its message.
    if value is None or isinstance(value, str | int | float | bool):
        return value
    return str(value)
