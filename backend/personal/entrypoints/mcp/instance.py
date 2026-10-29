"""The FastMCP instance: auth, transport security and the ``/login`` routes.

The tool modules in :mod:`personal.entrypoints.mcp.tools` register on it;
:mod:`personal.entrypoints.mcp.server` imports them all.
"""

import os

from mcp.server.auth.settings import AuthSettings, ClientRegistrationOptions
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import AnyHttpUrl

from .oauth import login_get, login_post, provider

_ISSUER = os.environ.get('MCP_ISSUER_URL', 'http://localhost:8001')
# Public host(s) the server is reachable at, used for DNS-rebinding protection.
# Behind nginx the backend sees Host: <public-host>, not localhost, so the
# default localhost-only allow-list would reject every proxied request with 421.
_PUBLIC_HOSTS = [
    h.strip()
    for h in os.environ.get('MCP_PUBLIC_HOST', 'localhost').split(',')
    if h.strip()
]

mcp = FastMCP(
    'djangopersonal-mcp',
    auth_server_provider=provider,
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=[
            *[host for h in _PUBLIC_HOSTS for host in (h, f'{h}:*')],
            '127.0.0.1:*',
            'localhost:*',
            '[::1]:*',
        ],
        allowed_origins=[
            *[f'https://{h}' for h in _PUBLIC_HOSTS if h != 'localhost'],
            *[f'http://{h}' for h in _PUBLIC_HOSTS if h != 'localhost'],
            'http://127.0.0.1:*',
            'http://localhost:*',
            'http://[::1]:*',
        ],
    ),
    auth=AuthSettings(
        issuer_url=AnyHttpUrl(_ISSUER),
        resource_server_url=AnyHttpUrl(f'{_ISSUER}/mcp'),
        client_registration_options=ClientRegistrationOptions(enabled=True),
    ),
)

mcp.custom_route('/login', methods=['GET'])(login_get)
mcp.custom_route('/login', methods=['POST'])(login_post)
