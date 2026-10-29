"""Calling MCP tools from tests."""

import asyncio
from typing import Any

from personal.entrypoints.mcp.server import mcp


def call(tool: str, /, **arguments: Any) -> Any:
    """Call a tool the way a client does and return its structured result.

    Every tool declares an output schema, so FastMCP answers with
    ``(content, structured)``; a non-object result is wrapped as ``{'result': ...}``.
    """
    outcome: Any = asyncio.run(mcp.call_tool(tool, arguments))
    _, structured = outcome
    return structured['result'] if set(structured) == {'result'} else structured
