"""FastMCP server exposing DjangoPersonal use cases as tools.

A separate service from the API (its own container, :8001), sharing the use
cases, repositories and database through :mod:`personal.entrypoints.mcp.runtime`. Every tool
call is one unit of work: one session, committed when the tool returns and
rolled back if it raised, exactly like one API request. Tools are thin: build a
contract, run one handler, serialize. The handlers are synchronous, so each
call runs in a worker thread; a raised error becomes the tool's error message
(FastMCP's ``ToolError``).

This module is the assembly point: the FastMCP instance lives in
:mod:`.instance`, the tools in :mod:`.tools` (one module per domain, helpers in
:mod:`.tools.common`). Importing :data:`mcp` from here guarantees every tool is
registered.
"""

from . import tools
from .instance import mcp

__all__ = ['mcp', 'tools']
