"""Composition root: builds the repositories use cases run against.

Same contract as ``apps.work.deps``: the HTTP layer asks this module for the
repositories it hands to a use case, and every call returns a fresh instance.
"""

from apps.infra.repo import CategoryRepository, TransactionRepository, WalletRepository


def wallet_repository() -> WalletRepository:
    return WalletRepository()


def category_repository() -> CategoryRepository:
    return CategoryRepository()


def transaction_repository() -> TransactionRepository:
    return TransactionRepository()
