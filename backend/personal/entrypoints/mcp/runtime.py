"""The MCP server's process-wide services: settings, database, auth adapters.

Built once at import from the same environment as the API (``personal.settings``),
so both services share one database and sign/verify the same JWTs. The tools
(``server.py``) and the OAuth login page (``oauth.py``) read them from here at
call time, which also lets tests swap :data:`database` for their own.
"""

import os

from personal import wiring
from personal.core.accounts.ports import PasswordHasher, TokenService
from personal.infra import tracing
from personal.infra.db import Database
from personal.settings import Settings

settings = Settings()
# One process (no uvicorn workers), so building it at import is safe; ``None``
# without an OTLP endpoint, as in the tests.
tracer_provider = tracing.tracer_provider(settings, tracing.MCP_SERVICE)
database = Database(settings, tracer_provider)
tokens: TokenService = wiring.token_service(settings)
hasher: PasswordHasher = wiring.password_hasher()


def _optional_int(name: str) -> int | None:
    value = os.environ.get(name, '').strip()
    return int(value) if value else None


#: The user stdio tool calls act for (there is no request to authenticate).
default_user_id = _optional_int('MCP_DEFAULT_USER_ID')
