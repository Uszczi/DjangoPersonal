from django.db.models import QuerySet
from django.http import HttpRequest
from typing import cast
from ninja import Router, Status
from ninja_jwt.authentication import JWTAuth

from apps.expenses import deps, handlers
from apps.expenses.contracts import (
    PatchedWalletRequest,
    WalletCreateRequest,
    WalletRequest,
    WalletResponse,
)
from apps.infra.models import User
from apps.infra.models import Wallet as WalletModel

router = Router(tags=['personal'])


@router.get(
    '/wallets/',
    response=list[WalletResponse],
    auth=JWTAuth(),
    operation_id='wallets_list',
)
def list_wallets(request: HttpRequest) -> QuerySet[WalletModel]:
    return handlers.ListWallets(deps.wallet_repository(), cast(User, request.user)).execute()


@router.post(
    '/wallets/',
    response={201: WalletResponse},
    auth=JWTAuth(),
    operation_id='wallets_create',
)
def create_wallet(request: HttpRequest, payload: WalletCreateRequest) -> Status[WalletModel]:
    handler = handlers.CreateWallet(
        deps.wallet_repository(),
        deps.category_repository(),
        deps.transaction_repository(),
        cast(User, request.user),
    )
    return Status(201, handler.execute(payload))


@router.get(
    '/wallets/{id}/',
    response=WalletResponse,
    auth=JWTAuth(),
    operation_id='wallets_retrieve',
)
def get_wallet(request: HttpRequest, id: int) -> WalletModel:
    return handlers.GetWallet(deps.wallet_repository(), cast(User, request.user)).execute(id)


@router.put(
    '/wallets/{id}/',
    response=WalletResponse,
    auth=JWTAuth(),
    operation_id='wallets_update',
)
def replace_wallet(request: HttpRequest, id: int, payload: WalletRequest) -> WalletModel:
    handler = handlers.ReplaceWallet(deps.wallet_repository(), cast(User, request.user))
    return handler.execute(id, payload)


@router.patch(
    '/wallets/{id}/',
    response=WalletResponse,
    auth=JWTAuth(),
    operation_id='wallets_partial_update',
)
def update_wallet(request: HttpRequest, id: int, payload: PatchedWalletRequest) -> WalletModel:
    handler = handlers.UpdateWallet(
        deps.wallet_repository(),
        deps.category_repository(),
        deps.transaction_repository(),
        cast(User, request.user),
    )
    return handler.execute(id, payload)


@router.delete(
    '/wallets/{id}/',
    response={204: None},
    auth=JWTAuth(),
    operation_id='wallets_destroy',
)
def delete_wallet(request: HttpRequest, id: int) -> Status[None]:
    handlers.DeleteWallet(deps.wallet_repository(), cast(User, request.user)).execute(id)
    return Status(204, None)
