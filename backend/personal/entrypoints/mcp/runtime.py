"""The MCP server's process-wide services: settings, database, auth adapters.

Built once at import from the same environment as the API (``personal.settings``),
so both services share one database and sign/verify the same JWTs. The tools
(``server.py``) and the OAuth login page (``oauth.py``) read them from here at
call time, which also lets tests swap :data:`database` for their own.
"""

import os

from personal import wiring
from personal.core.accounts.ports import PasswordHasher, RateLimiter, TokenService
from personal.core.notes_qa.ports import AnswerGenerator, Embedder
from personal.infra import tracing
from personal.infra.db import Database
from personal.settings import Settings

from .clients import ClientStore, client_store

settings = Settings()
# One process (no uvicorn workers), so building it at import is safe; ``None``
# without an OTLP endpoint, as in the tests.
tracer_provider = tracing.tracer_provider(settings, tracing.MCP_SERVICE)
database = Database(settings, tracer_provider)
tokens: TokenService = wiring.token_service(settings)
hasher: PasswordHasher = wiring.password_hasher()
#: Counts failed logins (the ``/login`` page and the ``login_user`` tool);
#: shared with the API through Redis when ``REDIS_URL`` is set.
limiter: RateLimiter = wiring.rate_limiter(settings)
#: Registered OAuth clients; in Redis when ``REDIS_URL`` is set, so a restart keeps them.
clients: ClientStore = client_store(settings)
#: The models behind ``ask_notes``; their HTTP clients pool connections across calls.
embedder: Embedder = wiring.embedder(settings)
answer_generator: AnswerGenerator = wiring.answer_generator(settings)


def _optional_int(name: str) -> int | None:
    value = os.environ.get(name, '').strip()
    return int(value) if value else None


#: The user stdio tool calls act for (there is no request to authenticate).
default_user_id = _optional_int('MCP_DEFAULT_USER_ID')
