"""ASGI application for the MCP server (streamable HTTP)."""

from .server import mcp

app = mcp.streamable_http_app()
