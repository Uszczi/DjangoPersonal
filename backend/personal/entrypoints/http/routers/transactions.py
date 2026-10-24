"""Transaction endpoints."""

from fastapi import APIRouter, Response, status

from personal.core.expenses import handlers
from personal.core.expenses.contracts import (
    PatchedTransactionRequest,
    TransactionRequest,
    TransactionResponse,
)
from personal.entrypoints.http.deps import (
    CategoryRepositoryDep,
    CurrentUser,
    TransactionRepositoryDep,
    WalletRepositoryDep,
)

router = APIRouter(tags=['personal'])


@router.get('/transactions/', operation_id='transactions_list')
def list_transactions(
    wallet: int,
    user: CurrentUser,
    transactions: TransactionRepositoryDep,
    wallets: WalletRepositoryDep,
) -> list[TransactionResponse]:
    found = handlers.ListTransactions(transactions, wallets, user).execute(wallet)
    return [TransactionResponse.model_validate(transaction) for transaction in found]


@router.post(
    '/transactions/',
    status_code=status.HTTP_201_CREATED,
    operation_id='transactions_create',
)
def create_transaction(
    payload: TransactionRequest,
    user: CurrentUser,
    transactions: TransactionRepositoryDep,
    wallets: WalletRepositoryDep,
    categories: CategoryRepositoryDep,
) -> TransactionResponse:
    handler = handlers.CreateTransaction(transactions, wallets, categories, user)
    return TransactionResponse.model_validate(handler.execute(payload))


@router.get('/transactions/{id}/', operation_id='transactions_retrieve')
def get_transaction(
    id: int, user: CurrentUser, transactions: TransactionRepositoryDep
) -> TransactionResponse:
    transaction = handlers.GetTransaction(transactions, user).execute(id)
    return TransactionResponse.model_validate(transaction)


@router.put('/transactions/{id}/', operation_id='transactions_update')
def replace_transaction(
    id: int,
    payload: TransactionRequest,
    user: CurrentUser,
    transactions: TransactionRepositoryDep,
    wallets: WalletRepositoryDep,
    categories: CategoryRepositoryDep,
) -> TransactionResponse:
    handler = handlers.ReplaceTransaction(transactions, wallets, categories, user)
    return TransactionResponse.model_validate(handler.execute(id, payload))


@router.patch('/transactions/{id}/', operation_id='transactions_partial_update')
def update_transaction(
    id: int,
    payload: PatchedTransactionRequest,
    user: CurrentUser,
    transactions: TransactionRepositoryDep,
    wallets: WalletRepositoryDep,
    categories: CategoryRepositoryDep,
) -> TransactionResponse:
    handler = handlers.UpdateTransaction(transactions, wallets, categories, user)
    return TransactionResponse.model_validate(handler.execute(id, payload))


@router.delete(
    '/transactions/{id}/',
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id='transactions_destroy',
)
def delete_transaction(id: int, user: CurrentUser, transactions: TransactionRepositoryDep) -> None:
    handlers.DeleteTransaction(transactions, user).execute(id)
