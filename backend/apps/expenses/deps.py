"""Composition root: builds the repositories use cases run against.

Same contract as ``apps.work.deps``: every provider takes the current
``Session`` (the request's, as a FastAPI dependency) and returns a fresh
repository on it; the routers declare the ``*Dep`` aliases.
"""

from typing import Annotated

from fastapi import Depends

from apps.infra.repo import CategoryRepository, TransactionRepository, WalletRepository
from config.db import SessionDep


def wallet_repository(session: SessionDep) -> WalletRepository:
    return WalletRepository(session)


def category_repository(session: SessionDep) -> CategoryRepository:
    return CategoryRepository(session)


def transaction_repository(session: SessionDep) -> TransactionRepository:
    return TransactionRepository(session)


WalletRepositoryDep = Annotated[WalletRepository, Depends(wallet_repository)]
CategoryRepositoryDep = Annotated[CategoryRepository, Depends(category_repository)]
TransactionRepositoryDep = Annotated[TransactionRepository, Depends(transaction_repository)]
