"""Resolve the current Django user from an MCP request context."""

import os
from typing import Any

from mcp.server.auth.middleware.auth_context import get_access_token


def get_request(ctx: Any) -> Any:
    try:
        return ctx.request_context.request
    except Exception:
        return None


def get_current_user(ctx: Any) -> Any:
    """Return the authenticated Django user for this MCP call.

    Prefers the OAuth access token established by the MCP auth middleware.
    Falls back to a Django JWT in the ``Authorization`` header, and finally to
    ``MCP_DEFAULT_USER_ID`` for stdio transport.
    """
    # OAuth path
    access = None
    try:
        access = get_access_token()
    except Exception:
        access = None
    if access is not None and getattr(access, "subject", None) is not None:
        from django.contrib.auth import get_user_model

        User = get_user_model()
        return User.objects.get(pk=int(str(access.subject)))

    request = get_request(ctx)
    if request is None:
        default_id = os.environ.get("MCP_DEFAULT_USER_ID")
        if default_id:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            return User.objects.get(pk=int(default_id))
        raise PermissionError(
            "No HTTP request context; set MCP_DEFAULT_USER_ID for stdio transport."
        )

    auth_header = None
    try:
        auth_header = request.headers.get("authorization")
    except Exception:
        try:
            auth_header = request.headers.get("Authorization")
        except Exception:
            auth_header = None

    if not auth_header or not str(auth_header).lower().startswith("bearer "):
        raise PermissionError("Missing or invalid Authorization: Bearer <token> header.")

    token = str(auth_header).split(" ", 1)[1].strip()
    from ninja_jwt.authentication import JWTBaseAuthentication

    auth = JWTBaseAuthentication()
    validated = auth.get_validated_token(token)
    return auth.get_user(validated)