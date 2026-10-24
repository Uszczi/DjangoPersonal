"""Run the MCP server as a standalone HTTP service (``just mcp``, the ``mcp`` container)."""

import os

import uvicorn

from .server import mcp

port = int(os.environ.get('MCP_PORT', '8001'))
uvicorn.run(mcp.streamable_http_app(), host='0.0.0.0', port=port)
