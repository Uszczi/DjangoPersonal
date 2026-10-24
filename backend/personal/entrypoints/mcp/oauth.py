"""In-memory OAuth authorization server for the MCP server.

Implements ``OAuthAuthorizationServerProvider`` so OpenCode can drive the full
OAuth flow (``opencode mcp auth``) instead of requiring a hand-managed JWT.
The resource owner signs in on ``/login`` with their account's username and
password, checked by the same use case as the API login.
"""

import secrets
import time
from html import escape
from urllib.parse import urlencode

import anyio.to_thread
from mcp.server.auth.provider import (
    AccessToken,
    AuthorizationCode,
    AuthorizationParams,
    OAuthAuthorizationServerProvider,
    RefreshToken,
)
from mcp.shared.auth import OAuthClientInformationFull, OAuthToken
from starlette.requests import Request
from starlette.responses import HTMLResponse, RedirectResponse, Response

from personal.core.accounts import handlers as accounts_handlers
from personal.core.accounts.contracts.auth import LoginRequest
from personal.core.shared.errors import DomainError
from personal.infra.repo import UserRepository

from . import runtime

_CLIENTS: dict[str, OAuthClientInformationFull] = {}
_AUTH_CODES: dict[str, AuthorizationCode] = {}
_ACCESS_TOKENS: dict[str, AccessToken] = {}
_REFRESH_TOKENS: dict[str, RefreshToken] = {}


def _now() -> float:
    return time.time()


class InMemoryOAuthProvider:
    """OAuth provider keeping clients, codes and tokens in process memory.

    A restart forgets them, so clients go through ``/login`` again.
    """

    async def get_client(self, client_id: str) -> OAuthClientInformationFull | None:
        return _CLIENTS.get(client_id)

    async def register_client(self, client_info: OAuthClientInformationFull) -> None:
        _CLIENTS[str(client_info.client_id)] = client_info

    async def authorize(self, client: OAuthClientInformationFull, params: AuthorizationParams) -> str:
        query = urlencode(
            {
                "client_id": client.client_id,
                "redirect_uri": str(params.redirect_uri),
                "state": params.state or "",
                "code_challenge": params.code_challenge,
                "scope": " ".join(params.scopes or []),
                "resource": params.resource or "",
            }
        )
        return f"/login?{query}"

    async def load_authorization_code(
        self, client: OAuthClientInformationFull, authorization_code: str
    ) -> AuthorizationCode | None:
        code = _AUTH_CODES.get(authorization_code)
        if code is None or code.client_id != client.client_id:
            return None
        return code

    async def exchange_authorization_code(
        self, client: OAuthClientInformationFull, authorization_code: AuthorizationCode
    ) -> OAuthToken:
        del client
        _AUTH_CODES.pop(authorization_code.code, None)

        subject = authorization_code.subject
        access = secrets.token_urlsafe(48)
        refresh = secrets.token_urlsafe(48)
        expires_in = 3600 * 24 * 7
        expires_at = int(_now()) + expires_in

        _ACCESS_TOKENS[access] = AccessToken(
            token=access,
            client_id=authorization_code.client_id,
            scopes=authorization_code.scopes,
            expires_at=expires_at,
            resource=authorization_code.resource,
            subject=subject,
        )
        _REFRESH_TOKENS[refresh] = RefreshToken(
            token=refresh,
            client_id=authorization_code.client_id,
            scopes=authorization_code.scopes,
            expires_at=expires_at + 3600 * 24 * 30,
            resource=authorization_code.resource,
            subject=subject,
        )
        return OAuthToken(
            access_token=access,
            token_type="Bearer",
            expires_in=expires_in,
            scope=" ".join(authorization_code.scopes) if authorization_code.scopes else None,
            refresh_token=refresh,
        )

    async def load_refresh_token(
        self, client: OAuthClientInformationFull, refresh_token: str
    ) -> RefreshToken | None:
        token = _REFRESH_TOKENS.get(refresh_token)
        if token is None or token.client_id != client.client_id:
            return None
        return token

    async def exchange_refresh_token(
        self,
        client: OAuthClientInformationFull,
        refresh_token: RefreshToken,
        scopes: list[str],
    ) -> OAuthToken:
        del client
        # rotate
        _REFRESH_TOKENS.pop(refresh_token.token, None)
        access = secrets.token_urlsafe(48)
        new_refresh = secrets.token_urlsafe(48)
        expires_in = 3600 * 24 * 7
        expires_at = int(_now()) + expires_in
        _ACCESS_TOKENS[access] = AccessToken(
            token=access,
            client_id=refresh_token.client_id,
            scopes=scopes or refresh_token.scopes,
            expires_at=expires_at,
            resource=refresh_token.resource,
            subject=refresh_token.subject,
        )
        _REFRESH_TOKENS[new_refresh] = RefreshToken(
            token=new_refresh,
            client_id=refresh_token.client_id,
            scopes=scopes or refresh_token.scopes,
            expires_at=expires_at + 3600 * 24 * 30,
            resource=refresh_token.resource,
            subject=refresh_token.subject,
        )
        return OAuthToken(
            access_token=access,
            token_type="Bearer",
            expires_in=expires_in,
            scope=" ".join(scopes or refresh_token.scopes),
            refresh_token=new_refresh,
        )

    async def load_access_token(self, token: str) -> AccessToken | None:
        access = _ACCESS_TOKENS.get(token)
        if access is None:
            return None
        if access.expires_at and access.expires_at < int(_now()):
            _ACCESS_TOKENS.pop(token, None)
            return None
        return access

    async def revoke_token(self, token: AccessToken | RefreshToken) -> None:
        if isinstance(token, AccessToken):
            _ACCESS_TOKENS.pop(token.token, None)
        else:
            _REFRESH_TOKENS.pop(token.token, None)


provider = InMemoryOAuthProvider()


_LOGIN_HTML = """<!doctype html>
<html>
  <head><title>MCP Login</title></head>
  <body>
    <h1>Sign in to DjangoPersonal MCP</h1>
    {error}
    <form method="post" action="/login">
      <input type="hidden" name="client_id" value="{client_id}" />
      <input type="hidden" name="redirect_uri" value="{redirect_uri}" />
      <input type="hidden" name="state" value="{state}" />
      <input type="hidden" name="code_challenge" value="{code_challenge}" />
      <input type="hidden" name="scope" value="{scope}" />
      <input type="hidden" name="resource" value="{resource}" />
      <p><label>Username <input name="username" autofocus /></label></p>
      <p><label>Password <input name="password" type="password" /></label></p>
      <p><button type="submit">Sign in</button></p>
    </form>
  </body>
</html>
"""


_FORM_FIELDS = ("client_id", "redirect_uri", "state", "code_challenge", "scope", "resource")


def _login_page(fields: dict[str, str], *, error: str = "") -> str:
    """The login form carrying the OAuth parameters through as hidden fields.

    The values come from the request, so they are escaped for HTML.
    """
    values = {name: escape(fields.get(name, ""), quote=True) for name in _FORM_FIELDS}
    return _LOGIN_HTML.format(error=error, **values)


async def login_get(request: Request) -> HTMLResponse:
    return HTMLResponse(_login_page(dict(request.query_params)))


def _authenticated_user_id(username: str, password: str) -> int | None:
    """The id of the account these credentials sign in to, or ``None``."""
    with runtime.database.transaction() as session:
        handler = accounts_handlers.AuthenticateUser(UserRepository(session), runtime.hasher)
        try:
            return handler.execute(LoginRequest(username=username, password=password)).id
        except DomainError:
            return None


def _is_registered_redirect(client: OAuthClientInformationFull, redirect_uri: str) -> bool:
    return any(str(uri) == redirect_uri for uri in client.redirect_uris or [])


def _login_sync(data: dict[str, str]) -> tuple[str, str, int]:
    username = data.get("username", "")
    password = data.get("password", "")
    client_id = data.get("client_id", "")
    redirect_uri = data.get("redirect_uri", "")
    state = data.get("state", "")
    code_challenge = data.get("code_challenge", "")
    scope = data.get("scope", "")
    resource = data.get("resource", "") or None

    client = _CLIENTS.get(client_id)
    if client is None or not _is_registered_redirect(client, redirect_uri):
        # The form is user-supplied: only a registered client's own redirect
        # URI may receive a code, or a crafted link could send it elsewhere.
        return ("html", _login_page(data, error="<p style='color:red'>Unknown client.</p>"), 400)

    user_id = _authenticated_user_id(username, password)
    if user_id is None:
        html = _login_page(data, error="<p style='color:red'>Invalid credentials.</p>")
        return ("html", html, 401)

    code = secrets.token_urlsafe(48)
    _AUTH_CODES[code] = AuthorizationCode(
        code=code,
        scopes=scope.split() if scope else [],
        expires_at=_now() + 300,
        client_id=client_id,
        code_challenge=code_challenge,
        redirect_uri=redirect_uri,  # type: ignore[arg-type]
        redirect_uri_provided_explicitly=True,
        resource=resource,
        subject=str(user_id),
    )

    redirect = redirect_uri
    sep = "&" if "?" in redirect else "?"
    params = {"code": code}
    if state:
        params["state"] = state
    return ("redirect", f"{redirect}{sep}{urlencode(params)}", 302)


async def login_post(request: Request) -> Response:
    form = await request.form()
    data = {str(k): str(v) for k, v in form.items()}
    kind, payload, status = await anyio.to_thread.run_sync(_login_sync, data)
    if kind == "html":
        return HTMLResponse(payload, status_code=status)
    return RedirectResponse(url=payload, status_code=status)
