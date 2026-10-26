"""Run the MCP server as a standalone HTTP service (``just mcp``, the ``mcp`` container)."""

import os

import uvicorn

from personal.log_config import configure_logging

from .asgi import create_served_app

configure_logging()
port = int(os.environ.get('MCP_PORT', '8001'))
uvicorn.run(create_served_app(), host='0.0.0.0', port=port)
