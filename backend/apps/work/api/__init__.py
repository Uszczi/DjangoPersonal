"""HTTP layer for the ``work`` app.

Routers only validate input, call one use case from ``apps.work.handlers``, and
shape the response; the domain rules live in that shared use-case layer, which
the MCP server calls too.
"""

from fastapi import APIRouter

from . import projects, tasks, time_entries, timer

router = APIRouter()
router.include_router(projects.router)
router.include_router(tasks.router)
router.include_router(time_entries.router)
router.include_router(timer.router)

__all__ = ['router']
