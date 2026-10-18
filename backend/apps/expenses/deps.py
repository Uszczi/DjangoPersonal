"""Composition root: builds the repositories use cases run against.

Same contract as ``apps.work.deps``: the HTTP layer asks this module for the
repositories it hands to a use case, and every call returns a fresh instance.
"""

from apps.infra.repo import WalletRepository


def wallet_repository() -> WalletRepository:
    return WalletRepository()
