"""Translate domain errors into HTTP responses.

This is the only place that knows a :class:`~personal.core.shared.errors.DomainError`
becomes a status code, so the use cases stay transport-agnostic.

Every 4xx answered here is also logged at WARNING with its reason (the
domain message, or each failing field and why), so a request the client
refuses to explain - "adding a series does nothing" - can be found in Loki
under ``client_error``. Input values are never logged: a body may carry a
password.

The validation handler keeps the request-validation response shape the API
was first published with (Django Ninja's), since the frontend reads it.
"""

import logging
from collections.abc import Sequence
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.routing import APIRoute

from personal.core.shared.errors import DomainError, NotFound, RateLimited

STATUS_BY_CODE = {
    DomainError.code: 400,
    NotFound.code: 404,
    RateLimited.code: 429,
}

UNPARSABLE_BODY_DETAIL = 'Cannot parse request body'

logger = logging.getLogger(__name__)


def _log_client_error(request: Request, status: int, reason: str) -> None:
    """One greppable line per refused request: ``client_error status=422 ...``."""
    logger.warning(
        'client_error status=%d method=%s path=%s reason=%s',
        status,
        request.method,
        request.url.path,
        reason,
    )


def status_for(error: DomainError) -> int:
    if error.status is not None:
        return error.status
    return STATUS_BY_CODE.get(error.code, 400)


def register_fastapi_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DomainError, _handle_domain_error)
    app.add_exception_handler(RequestValidationError, _handle_validation_error)
    # Starlette calls this one for any unhandled error, then re-raises it, so
    # uvicorn still logs the full traceback next to the one-line summary.
    app.add_exception_handler(Exception, _handle_server_error)


async def _handle_domain_error(request: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, DomainError)
    headers = None
    if isinstance(error, RateLimited):
        headers = {'Retry-After': str(error.retry_after)}
    status = status_for(error)
    _log_client_error(request, status, f'{error.code}: {error.message}')
    return JSONResponse({'detail': error.message}, status_code=status, headers=headers)


async def _handle_server_error(request: Request, error: Exception) -> PlainTextResponse:
    """A one-line ``server_error`` with the request's trace_id.

    uvicorn's traceback spans many log lines and carries no trace_id; this
    line is the one to search for in Loki (only the error's first line, which
    for a database error names the constraint, not the row).
    """
    summary = (str(error).splitlines() or [''])[0]
    logger.error(
        'server_error status=500 method=%s path=%s error=%s: %s',
        request.method,
        request.url.path,
        type(error).__name__,
        summary,
    )
    return PlainTextResponse('Internal Server Error', status_code=500)


async def _handle_validation_error(request: Request, error: Exception) -> JSONResponse:
    """Answer in the API's published validation-error shape.

    - malformed JSON is a 400 with a plain message, not a validation error;
    - every other error is a 422 listing ``type``/``loc``/``msg`` (+ ``ctx``),
      without the ``input``/``url`` keys FastAPI adds;
    - a body error is located under the body parameter's name
      (``['body', 'payload', 'name']``), which FastAPI omits for a single body.
    """
    assert isinstance(error, RequestValidationError)
    errors: Sequence[Any] = error.errors()
    if any(item.get('type') == 'json_invalid' for item in errors):
        _log_client_error(request, 400, UNPARSABLE_BODY_DETAIL)
        return JSONResponse({'detail': UNPARSABLE_BODY_DETAIL}, status_code=400)

    body_name = _unembedded_body_name(request)
    detail = [_shaped_error(item, body_name) for item in errors]
    _log_client_error(request, 422, '; '.join(_describe(item) for item in detail))
    return JSONResponse({'detail': detail}, status_code=422)


def _describe(error: dict[str, Any]) -> str:
    """``body.payload.kind: Input should be 'film' or 'book'`` - no input value."""
    location = '.'.join(str(part) for part in error['loc'])
    return f"{location}: {error['msg']}"


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


def _shaped_error(item: Any, body_name: str | None) -> dict[str, Any]:
    loc = list(item['loc'])
    if body_name is not None and loc[:1] == ['body']:
        loc.insert(1, body_name)
    shaped: dict[str, Any] = {'type': item['type'], 'loc': loc, 'msg': item['msg']}
    if 'ctx' in item:
        shaped['ctx'] = {key: _json_scalar(value) for key, value in item['ctx'].items()}
    return shaped


def _json_scalar(value: object) -> object:
    # ``ctx`` may hold the raised exception (``{'error': ValueError(...)}``);
    # The published shape carries its message.
    if value is None or isinstance(value, str | int | float | bool):
        return value
    return str(value)
