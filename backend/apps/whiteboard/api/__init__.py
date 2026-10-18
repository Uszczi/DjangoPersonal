"""HTTP layer for the ``whiteboard`` app."""
from ninja import Router

from . import whiteboards

router = Router()
router.add_router('', whiteboards.router)

__all__ = ['router']