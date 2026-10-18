"""Run the MCP server as a standalone HTTP service."""

import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

import uvicorn

from .server import mcp

port = int(os.environ.get("MCP_PORT", "8001"))
uvicorn.run(mcp.streamable_http_app(), host="0.0.0.0", port=port)