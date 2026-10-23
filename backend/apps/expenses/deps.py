"""Composition root: builds the repositories use cases run against.

Same contract as ``apps.work.deps``: callers pass the current ``Session`` and
every call returns a fresh repository on it.
"""

from sqlalchemy.orm import Session

from apps.infra.repo import CategoryRepository, TransactionRepository, WalletRepository


def wallet_repository(session: Session) -> WalletRepository:
    return WalletRepository(session)


def category_repository(session: Session) -> CategoryRepository:
    return CategoryRepository(session)


def transaction_repository(session: Session) -> TransactionRepository:
    return TransactionRepository(session)
