"""HTTP layer for the ``expenses`` app."""

from fastapi import APIRouter

from . import categories, transactions, wallets

router = APIRouter()
router.include_router(wallets.router)
router.include_router(categories.router)
router.include_router(transactions.router)

__all__ = ['router']
