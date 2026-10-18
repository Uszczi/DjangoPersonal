from ninja import Router

from .wallets import router as wallets_router

router = Router()
router.add_router('', wallets_router)
