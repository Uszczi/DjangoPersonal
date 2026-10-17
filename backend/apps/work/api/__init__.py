"""HTTP layer for the ``work`` app.

Routers only validate input, call one use case from ``apps.work.handlers``, and
shape the response; the domain rules live in that shared use-case layer, which a
future MCP server can call too.
"""

from ninja import Router

from . import projects, tasks, time_entries, timer

router = Router()
router.add_router('', projects.router)
router.add_router('', tasks.router)
router.add_router('', time_entries.router)
router.add_router('', timer.router)

__all__ = ['router']
