"""Wallet use cases."""

from functools import partial

from django.contrib.auth.models import AbstractUser
from django.db.models import QuerySet

from apps.infra.models import User
from apps.infra.models import Wallet as WalletModel
from apps.infra.models import normalize_wallet_name, wallet_name_key
from apps.infra.repo import CategoryRepository, DuplicateWalletName, WalletRepository
from apps.shared.errors import DomainError, NotFound

from ..contracts import PatchedWalletRequest, WalletRequest
from ._patch import apply_provided
from .categories import seed_base_categories

UserType = AbstractUser


def _get_wallet(
    repository: WalletRepository, wallet_id: int, *, user: User
) -> WalletModel:
    """Fetch a wallet addressed by id, or raise ``NotFound``."""
    wallet = repository.find(wallet_id, user=user)
    if wallet is None:
        raise NotFound('Wallet not found.')
    return wallet


def _validate_name(
    repository: WalletRepository,
    name: str,
    current: WalletModel | None = None,
    *,
    user: User,
) -> str:
    """Return the trimmed wallet name, or raise when it breaks a naming rule."""
    name = normalize_wallet_name(name)
    name_key = wallet_name_key(name)

    if repository.name_taken(name_key, user=user, exclude=current):
        raise DomainError('A wallet with this name already exists.')

    return name


def _save(repository: WalletRepository, wallet: WalletModel) -> WalletModel:
    """Persist a wallet, presenting a name clash as a domain error."""
    try:
        return repository.save(wallet)
    except DuplicateWalletName as error:
        raise DomainError('A wallet with this name already exists.') from error


class ListWallets:
    """List every wallet.

    ``transaction_count`` comes from the response default until the
    Transaction model lands (ticket 03), which annotates the real count.
    """

    def __init__(self, wallets: WalletRepository, user: User):
        self.wallets = wallets
        self.user = user

    def execute(self) -> QuerySet[WalletModel]:
        return self.wallets.list_all(user=self.user)


class GetWallet:
    """Fetch a single wallet addressed by id."""

    def __init__(self, wallets: WalletRepository, user: User):
        self.wallets = wallets
        self.user = user

    def execute(self, wallet_id: int) -> WalletModel:
        return _get_wallet(self.wallets, wallet_id, user=self.user)


class CreateWallet:
    """Create a wallet from a validated payload.

    A user's very first wallet also seeds their base categories, so they can
    categorize spending immediately.
    """

    def __init__(
        self,
        wallets: WalletRepository,
        categories: CategoryRepository,
        user: User,
    ):
        self.wallets = wallets
        self.categories = categories
        self.user = user

    def execute(self, data: WalletRequest) -> WalletModel:
        is_first_wallet = self.wallets.count(user=self.user) == 0
        wallet = WalletModel(
            user=self.user,
            name=_validate_name(self.wallets, data.name, user=self.user),
        )
        created = _save(self.wallets, wallet)
        if is_first_wallet:
            seed_base_categories(self.categories, self.user)
        return created


class ReplaceWallet:
    """Replace a wallet wholesale with the supplied payload (PUT)."""

    def __init__(self, wallets: WalletRepository, user: User):
        self.wallets = wallets
        self.user = user

    def execute(self, wallet_id: int, data: WalletRequest) -> WalletModel:
        wallet = _get_wallet(self.wallets, wallet_id, user=self.user)
        apply_provided(
            data,
            wallet,
            resolve={
                'name': partial(_validate_name, self.wallets, current=wallet, user=self.user)
            },
        )
        return _save(self.wallets, wallet)


class UpdateWallet:
    """Apply the supplied fields to an existing wallet (PATCH)."""

    def __init__(self, wallets: WalletRepository, user: User):
        self.wallets = wallets
        self.user = user

    def execute(self, wallet_id: int, data: PatchedWalletRequest) -> WalletModel:
        wallet = _get_wallet(self.wallets, wallet_id, user=self.user)

        apply_provided(
            data,
            wallet,
            resolve={
                'name': partial(_validate_name, self.wallets, current=wallet, user=self.user)
            },
        )

        return _save(self.wallets, wallet)


class DeleteWallet:
    """Delete a wallet; its transactions cascade away."""

    def __init__(self, wallets: WalletRepository, user: User):
        self.wallets = wallets
        self.user = user

    def execute(self, wallet_id: int) -> None:
        wallet = _get_wallet(self.wallets, wallet_id, user=self.user)
        self.wallets.delete(wallet)
