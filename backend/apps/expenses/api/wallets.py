"""Wallet endpoints."""

from fastapi import APIRouter, Response, status

from apps.accounts.deps import CurrentUser
from apps.expenses import handlers
from apps.expenses.contracts import (
    PatchedWalletRequest,
    WalletCreateRequest,
    WalletRequest,
    WalletResponse,
)
from apps.expenses.deps import CategoryRepositoryDep, TransactionRepositoryDep, WalletRepositoryDep

router = APIRouter(tags=['personal'])


@router.get('/wallets/', operation_id='wallets_list')
def list_wallets(user: CurrentUser, wallets: WalletRepositoryDep) -> list[WalletResponse]:
    return [
        WalletResponse.model_validate(wallet)
        for wallet in handlers.ListWallets(wallets, user).execute()
    ]


@router.post(
    '/wallets/',
    status_code=status.HTTP_201_CREATED,
    operation_id='wallets_create',
)
def create_wallet(
    payload: WalletCreateRequest,
    user: CurrentUser,
    wallets: WalletRepositoryDep,
    categories: CategoryRepositoryDep,
    transactions: TransactionRepositoryDep,
) -> WalletResponse:
    handler = handlers.CreateWallet(wallets, categories, transactions, user)
    return WalletResponse.model_validate(handler.execute(payload))


@router.get('/wallets/{id}/', operation_id='wallets_retrieve')
def get_wallet(id: int, user: CurrentUser, wallets: WalletRepositoryDep) -> WalletResponse:
    return WalletResponse.model_validate(handlers.GetWallet(wallets, user).execute(id))


@router.put('/wallets/{id}/', operation_id='wallets_update')
def replace_wallet(
    id: int, payload: WalletRequest, user: CurrentUser, wallets: WalletRepositoryDep
) -> WalletResponse:
    return WalletResponse.model_validate(handlers.ReplaceWallet(wallets, user).execute(id, payload))


@router.patch('/wallets/{id}/', operation_id='wallets_partial_update')
def update_wallet(
    id: int,
    payload: PatchedWalletRequest,
    user: CurrentUser,
    wallets: WalletRepositoryDep,
    categories: CategoryRepositoryDep,
    transactions: TransactionRepositoryDep,
) -> WalletResponse:
    handler = handlers.UpdateWallet(wallets, categories, transactions, user)
    return WalletResponse.model_validate(handler.execute(id, payload))


@router.delete(
    '/wallets/{id}/',
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id='wallets_destroy',
)
def delete_wallet(id: int, user: CurrentUser, wallets: WalletRepositoryDep) -> None:
    handlers.DeleteWallet(wallets, user).execute(id)
