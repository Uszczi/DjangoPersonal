"""HTTP layer for the ``work`` app.

The routes are grouped per resource; the domain rules they call live in
``services`` and the payload/response shapes in ``schemas``.
"""

from ninja import Router

from . import projects, tasks, time_entries, timer

router = Router()
router.add_router('', projects.router)
router.add_router('', tasks.router)
router.add_router('', time_entries.router)
router.add_router('', timer.router)

__all__ = ['router']
