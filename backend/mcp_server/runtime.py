"""The MCP server's process-wide services: settings, database, auth adapters.

Built once at import from the same environment as the API (``config.app_settings``),
so both services share one database and sign/verify the same JWTs. The tools
(``server.py``) and the OAuth login page (``oauth.py``) read them from here at
call time, which also lets tests swap :data:`database` for their own.
"""

import os

from apps.accounts import deps as accounts_deps
from apps.accounts.ports import PasswordHasher, TokenService
from config.app_settings import Settings
from config.db import Database

settings = Settings()
database = Database(settings)
tokens: TokenService = accounts_deps.token_service(settings)
hasher: PasswordHasher = accounts_deps.password_hasher()


def _optional_int(name: str) -> int | None:
    value = os.environ.get(name, '').strip()
    return int(value) if value else None


#: The user stdio tool calls act for (there is no request to authenticate).
default_user_id = _optional_int('MCP_DEFAULT_USER_ID')
