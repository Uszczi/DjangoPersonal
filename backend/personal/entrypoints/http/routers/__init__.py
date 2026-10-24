"""The API's routers, one module per resource.

Routers only validate input, call one use case from ``personal.core``, and shape
the response; the domain rules live in that shared use-case layer, which the MCP
server calls too.
"""

from fastapi import APIRouter

from . import (
    auth,
    categories,
    projects,
    tasks,
    time_entries,
    timer,
    transactions,
    wallets,
    whiteboards,
)

# The order is the order of the paths in the OpenAPI schema.
router = APIRouter()
for module in (
    auth,
    projects,
    tasks,
    time_entries,
    timer,
    whiteboards,
    wallets,
    categories,
    transactions,
):
    router.include_router(module.router)

__all__ = ['router']
