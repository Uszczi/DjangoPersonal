"""The MCP tools, one module per domain.

Importing a module registers its tools on :data:`personal.entrypoints.mcp.instance.mcp`;
the import order is the order clients list the tools in.
"""

from . import work, accounts, expenses, counters, bibliography, whiteboard, notes_qa

__all__ = ['work', 'accounts', 'expenses', 'counters', 'bibliography', 'whiteboard', 'notes_qa']
