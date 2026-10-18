from ninja import Router

from .categories import router as categories_router
from .transactions import router as transactions_router
from .wallets import router as wallets_router

router = Router()
router.add_router('', wallets_router)
router.add_router('', categories_router)
router.add_router('', transactions_router)
