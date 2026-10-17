from ninja import Router

from . import auth

router = Router()
router.add_router('', auth.router)

__all__ = ['router']