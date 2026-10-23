"""Transport-agnostic HTTP client for the API tests.

The suite talks to the API only through :class:`ApiClient`, which sends JSON and
hands back a :class:`Response` with ``status_code``, ``json()`` and ``text``.
What actually serves the request is a :class:`Transport`: Django's test client
today, FastAPI's ``TestClient`` once the port lands. Tests must not reach past
this module for anything framework-specific (``content_type=``,
``response.content``, ``HTTP_*`` headers, ...), so the same suite can be run
against either backend with ``--backend``.
"""

import json as jsonlib
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class Response:
    status_code: int
    body: bytes

    @property
    def text(self) -> str:
        return self.body.decode()

    def json(self) -> Any:
        return jsonlib.loads(self.body)


class Transport(Protocol):
    """Delivers one request to the application under test."""

    def request(
        self, method: str, path: str, *, body: bytes | None, headers: dict[str, str]
    ) -> Response: ...


class ApiClient:
    """A JSON API client, optionally authenticated with a bearer token."""

    def __init__(self, transport: Transport, *, token: str | None = None):
        self.transport = transport
        self.token = token

    def authenticated(self, token: str) -> 'ApiClient':
        """A client sharing this transport that sends ``token``."""
        return ApiClient(self.transport, token=token)

    def request(
        self,
        method: str,
        path: str,
        json: Any = None,
        *,
        headers: dict[str, str] | None = None,
    ) -> Response:
        merged = {'Content-Type': 'application/json'}
        if self.token is not None:
            merged['Authorization'] = f'Bearer {self.token}'
        merged.update(headers or {})
        body = None if json is None else jsonlib.dumps(json).encode()
        return self.transport.request(method, path, body=body, headers=merged)

    def get(self, path: str, *, headers: dict[str, str] | None = None) -> Response:
        return self.request('GET', path, headers=headers)

    def post(
        self, path: str, json: Any = None, *, headers: dict[str, str] | None = None
    ) -> Response:
        return self.request('POST', path, json, headers=headers)

    def put(
        self, path: str, json: Any = None, *, headers: dict[str, str] | None = None
    ) -> Response:
        return self.request('PUT', path, json, headers=headers)

    def patch(
        self, path: str, json: Any = None, *, headers: dict[str, str] | None = None
    ) -> Response:
        return self.request('PATCH', path, json, headers=headers)

    def delete(self, path: str, *, headers: dict[str, str] | None = None) -> Response:
        return self.request('DELETE', path, headers=headers)


class DjangoTransport:
    """Serves requests through ``django.test.Client``."""

    def __init__(self) -> None:
        from django.test import Client

        self.client = Client()

    def request(
        self, method: str, path: str, *, body: bytes | None, headers: dict[str, str]
    ) -> Response:
        headers = dict(headers)
        content_type = headers.pop('Content-Type', 'application/json')
        response = self.client.generic(
            method,
            path,
            data=body or b'',
            content_type=content_type,
            headers=headers,
        )
        return Response(status_code=response.status_code, body=response.content)
