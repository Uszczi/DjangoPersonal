"""Idempotency keys: a write sent twice runs once.

A client that queues writes while offline (the mobile Running timer) sends
each one with an ``Idempotency-Key`` header, a UUID per operation. When the
request reached the server but the answer was lost, the client sends it again
with the same key, and this middleware replays the stored answer instead of
running the write twice.

Only authenticated writes (POST, PUT, PATCH, DELETE) carrying the header take
part; everything else passes straight through. Each key belongs to one user and
one request (method and path) and is kept for :data:`KEY_LIFETIME`, as long as
the timer accepts a late action.

The steps are separate units of work: the key is claimed (committed) before the
request runs, so a copy arriving meanwhile gets a 409 instead of running too;
the answer is stored after it. A server error (5xx) frees the key, so a retry
runs the request again. A claim left behind by a crash counts as abandoned after
:data:`CLAIM_TIMEOUT`.
"""

import json
import logging
from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID

from starlette.concurrency import run_in_threadpool
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from personal import wiring
from personal.core.accounts.ports import InvalidToken, TokenService
from personal.core.work import clock
from personal.core.work.handlers.timer import MAX_DELAY
from personal.infra.db import Database
from personal.infra.repo import DuplicateIdempotencyKey

logger = logging.getLogger(__name__)

HEADER = b'idempotency-key'
WRITE_METHODS = frozenset({'POST', 'PUT', 'PATCH', 'DELETE'})
MAX_KEY_LENGTH = 255
#: As long as a queued timer action may wait before it is sent.
KEY_LIFETIME = MAX_DELAY
#: A claim older than this with no stored answer was left by a crash.
CLAIM_TIMEOUT = timedelta(minutes=1)
#: Answers larger than this are not stored; a retry runs the request again.
MAX_STORED_BODY = 1024 * 1024


@dataclass(frozen=True)
class _Claimed:
    record_id: UUID


@dataclass(frozen=True)
class _Replay:
    status_code: int
    content_type: str
    body: bytes


@dataclass(frozen=True)
class _Refused:
    status_code: int
    reason: str
    detail: str


_Outcome = _Claimed | _Replay | _Refused | None


def _claim(
    database: Database, tokens: TokenService, token: str, key: str, method: str, path: str
) -> _Outcome:
    """Claim ``key`` for this request, or say what to answer instead; ``None`` skips it."""
    now = clock.now()
    with database.transaction() as session:
        try:
            user = wiring.authenticate(token, tokens=tokens, session=session)
        except InvalidToken:
            return None  # the endpoint answers 401 itself
        keys = wiring.idempotency_key_repository(session)
        keys.delete_older_than(now - KEY_LIFETIME, user=user)
        found = keys.find(key, user=user)
        if found is None:
            return _Claimed(keys.claim(key, user=user, method=method, path=path, at=now).id)
        if (found.method, found.path) != (method, path):
            return _Refused(
                422, 'idempotency_key_reused', 'This Idempotency-Key was used for another request.'
            )
        if found.status_code is not None:
            return _Replay(found.status_code, found.content_type, found.body)
        if found.created_at > now - CLAIM_TIMEOUT:
            return _Refused(
                409,
                'idempotency_key_in_progress',
                'A request with this Idempotency-Key is still running.',
            )
        found.created_at = now  # abandoned by a crash: run it again
        return _Claimed(found.id)


def _finish(
    database: Database, record_id: UUID, status_code: int, content_type: str, body: bytes | None
) -> None:
    """Store the answer, or free the key when there is none worth replaying."""
    with database.transaction() as session:
        keys = wiring.idempotency_key_repository(session)
        record = keys.get(record_id)
        if record is None:
            return
        if body is None or status_code >= 500:
            keys.delete(record)
        else:
            keys.complete(record, status_code=status_code, content_type=content_type, body=body)


def _header(scope: Scope, name: bytes) -> str | None:
    for key, value in scope['headers']:
        if key == name:
            return str(value.decode('latin-1'))
    return None


def _bearer(scope: Scope) -> str | None:
    authorization = _header(scope, b'authorization')
    if authorization is None:
        return None
    scheme, _, token = authorization.partition(' ')
    if scheme.lower() != 'bearer':
        return None
    return token.strip() or None


async def _respond(
    send: Send, status_code: int, content_type: str, body: bytes, replayed: bool = False
) -> None:
    headers = [
        (b'content-length', str(len(body)).encode()),
    ]
    if content_type:
        headers.append((b'content-type', content_type.encode('latin-1')))
    if replayed:
        headers.append((b'idempotent-replayed', b'true'))
    await send({'type': 'http.response.start', 'status': status_code, 'headers': headers})
    await send({'type': 'http.response.body', 'body': body})


class IdempotencyMiddleware:
    """Replays the stored answer to a write sent again with the same ``Idempotency-Key``."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope['type'] != 'http' or scope['method'] not in WRITE_METHODS:
            await self.app(scope, receive, send)
            return
        key = _header(scope, HEADER)
        token = _bearer(scope)
        if key is None or token is None:
            await self.app(scope, receive, send)
            return

        method, path = scope['method'], scope['path']
        if not key or len(key) > MAX_KEY_LENGTH:
            await self._refuse(send, method, path, _Refused(
                400, 'idempotency_key_invalid',
                f'The Idempotency-Key must be 1 to {MAX_KEY_LENGTH} characters.',
            ))
            return

        state = scope['app'].state
        database: Database = state.database
        tokens = wiring.token_service(state.settings)
        try:
            outcome = await run_in_threadpool(_claim, database, tokens, token, key, method, path)
        except DuplicateIdempotencyKey:
            # The same key claimed at the same moment by another copy: now it is taken.
            outcome = await run_in_threadpool(_claim, database, tokens, token, key, method, path)

        if outcome is None:
            await self.app(scope, receive, send)
        elif isinstance(outcome, _Refused):
            await self._refuse(send, method, path, outcome)
        elif isinstance(outcome, _Replay):
            await _respond(send, outcome.status_code, outcome.content_type, outcome.body, True)
        else:
            await self._run(scope, receive, send, database, outcome.record_id)

    async def _run(
        self, scope: Scope, receive: Receive, send: Send, database: Database, record_id: UUID
    ) -> None:
        """Run the request, collecting its answer to store once it is sent."""
        status_code = 500
        content_type = ''
        chunks: list[bytes] = []
        size = 0

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code, content_type, size
            if message['type'] == 'http.response.start':
                status_code = message['status']
                for name, value in message.get('headers', []):
                    if name.lower() == b'content-type':
                        content_type = value.decode('latin-1')
            elif message['type'] == 'http.response.body':
                chunk = message.get('body', b'')
                size += len(chunk)
                if size <= MAX_STORED_BODY:
                    chunks.append(chunk)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except BaseException:
            await run_in_threadpool(_finish, database, record_id, 500, '', None)
            raise
        body = b''.join(chunks) if size <= MAX_STORED_BODY else None
        await run_in_threadpool(_finish, database, record_id, status_code, content_type, body)

    async def _refuse(self, send: Send, method: str, path: str, refused: _Refused) -> None:
        logger.warning(
            'client_error status=%d method=%s path=%s reason=%s',
            refused.status_code,
            method,
            path,
            refused.reason,
        )
        body = json.dumps({'detail': refused.detail}).encode()
        await _respond(send, refused.status_code, 'application/json', body)
