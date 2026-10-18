"""ASGI application for the MCP server (streamable HTTP)."""

import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from .server import mcp

app = mcp.streamable_http_app()