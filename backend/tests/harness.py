"""Transport-agnostic HTTP client for the API tests.

The suite talks to the API only through :class:`ApiClient`, which sends JSON and
hands back a :class:`Response` with ``status_code``, ``json()`` and ``text``.
What actually serves the request is a :class:`Transport` (FastAPI's
``TestClient``). Tests do not reach past this module for anything
framework-specific, so the suite describes the HTTP contract and nothing else.
"""

import json as jsonlib
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Protocol

if TYPE_CHECKING:
    from fastapi import FastAPI


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


class FastAPITransport:
    """Serves requests through FastAPI's ``TestClient``.

    Server errors come back as 500 responses, as they would over the wire,
    instead of being re-raised into the test.
    """

    def __init__(self, app: 'FastAPI') -> None:
        from fastapi.testclient import TestClient

        self.client = TestClient(app, raise_server_exceptions=False)

    def request(
        self, method: str, path: str, *, body: bytes | None, headers: dict[str, str]
    ) -> Response:
        response = self.client.request(method, path, content=body, headers=headers)
        return Response(status_code=response.status_code, body=response.content)
