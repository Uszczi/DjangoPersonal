from django.db.models import QuerySet
from django.http import HttpRequest
from typing import cast
from ninja import Router, Status
from ninja_jwt.authentication import JWTAuth

from apps.expenses import deps, handlers
from apps.expenses.contracts import (
    PatchedTransactionRequest,
    TransactionRequest,
    TransactionResponse,
)
from apps.infra.models import User
from apps.infra.models import Transaction as TransactionModel

router = Router(tags=['personal'])


@router.get(
    '/transactions/',
    response=list[TransactionResponse],
    auth=JWTAuth(),
    operation_id='transactions_list',
)
def list_transactions(request: HttpRequest, wallet: int) -> QuerySet[TransactionModel]:
    return handlers.ListTransactions(
        deps.transaction_repository(), deps.wallet_repository(), cast(User, request.user)
    ).execute(wallet)


@router.post(
    '/transactions/',
    response={201: TransactionResponse},
    auth=JWTAuth(),
    operation_id='transactions_create',
)
def create_transaction(request: HttpRequest, payload: TransactionRequest) -> Status[TransactionModel]:
    handler = handlers.CreateTransaction(
        deps.transaction_repository(),
        deps.wallet_repository(),
        deps.category_repository(),
        cast(User, request.user),
    )
    return Status(201, handler.execute(payload))


@router.get(
    '/transactions/{id}/',
    response=TransactionResponse,
    auth=JWTAuth(),
    operation_id='transactions_retrieve',
)
def get_transaction(request: HttpRequest, id: int) -> TransactionModel:
    return handlers.GetTransaction(
        deps.transaction_repository(), cast(User, request.user)
    ).execute(id)


@router.put(
    '/transactions/{id}/',
    response=TransactionResponse,
    auth=JWTAuth(),
    operation_id='transactions_update',
)
def replace_transaction(
    request: HttpRequest, id: int, payload: TransactionRequest
) -> TransactionModel:
    handler = handlers.ReplaceTransaction(
        deps.transaction_repository(),
        deps.wallet_repository(),
        deps.category_repository(),
        cast(User, request.user),
    )
    return handler.execute(id, payload)


@router.patch(
    '/transactions/{id}/',
    response=TransactionResponse,
    auth=JWTAuth(),
    operation_id='transactions_partial_update',
)
def update_transaction(
    request: HttpRequest, id: int, payload: PatchedTransactionRequest
) -> TransactionModel:
    handler = handlers.UpdateTransaction(
        deps.transaction_repository(),
        deps.wallet_repository(),
        deps.category_repository(),
        cast(User, request.user),
    )
    return handler.execute(id, payload)


@router.delete(
    '/transactions/{id}/',
    response={204: None},
    auth=JWTAuth(),
    operation_id='transactions_destroy',
)
def delete_transaction(request: HttpRequest, id: int) -> Status[None]:
    handlers.DeleteTransaction(
        deps.transaction_repository(), cast(User, request.user)
    ).execute(id)
    return Status(204, None)
