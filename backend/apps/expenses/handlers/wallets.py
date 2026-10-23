"""Wallet use cases."""

from datetime import date
from decimal import Decimal
from functools import partial

from apps.infra.models import Transaction as TransactionModel
from apps.infra.models import User
from apps.infra.models import Wallet as WalletModel
from apps.infra.rules import normalize_wallet_name, wallet_name_key
from apps.infra.repo import (
    CategoryRepository,
    DuplicateWalletName,
    TransactionRepository,
    WalletRepository,
)
from apps.shared.errors import DomainError, NotFound

from ..contracts import PatchedWalletRequest, WalletCreateRequest, WalletRequest
from ._patch import apply_provided
from .categories import ensure_system_category

#: The two entries the balance ledger writes itself: the opening balance the
#: wallet is created with, and the correction when the current balance is set.
OPENING_BALANCE_TITLE = 'Stan początkowy'
BALANCE_CORRECTION_TITLE = 'Korekta stanu'


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
    """List every wallet, with its transaction count and balance."""

    def __init__(self, wallets: WalletRepository, user: User):
        self.wallets = wallets
        self.user = user

    def execute(self) -> list[WalletModel]:
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

    The account's categories were seeded at registration, so this only has to
    open the wallet. An opening balance, when given, is written straight away
    as a System transaction so the wallet's balance is always the sum of its
    ledger.
    """

    def __init__(
        self,
        wallets: WalletRepository,
        categories: CategoryRepository,
        transactions: TransactionRepository,
        user: User,
    ):
        self.wallets = wallets
        self.categories = categories
        self.transactions = transactions
        self.user = user

    def execute(self, data: WalletCreateRequest) -> WalletModel:
        wallet = WalletModel(
            user=self.user,
            name=_validate_name(self.wallets, data.name, user=self.user),
        )
        created = _save(self.wallets, wallet)
        if data.initial_balance:
            self._record_opening_balance(created, data.initial_balance)
        # Re-read so the response carries the annotated count and balance the
        # opening entry just produced.
        return self.wallets.find(created.id, user=self.user) or created

    def _record_opening_balance(self, wallet: WalletModel, amount: Decimal) -> None:
        system = ensure_system_category(self.categories, self.user)
        self.transactions.save(
            TransactionModel(
                user=self.user,
                wallet=wallet,
                category=system,
                title=OPENING_BALANCE_TITLE,
                amount=amount,
                date=date.today(),
            )
        )


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
    """Apply the supplied fields to an existing wallet (PATCH).

    Renaming is ordinary. Setting ``current_balance`` records the difference
    against the wallet's computed balance as a System transaction, so the
    ledger keeps summing to what the user says they have.
    """

    def __init__(
        self,
        wallets: WalletRepository,
        categories: CategoryRepository,
        transactions: TransactionRepository,
        user: User,
    ):
        self.wallets = wallets
        self.categories = categories
        self.transactions = transactions
        self.user = user

    def execute(self, wallet_id: int, data: PatchedWalletRequest) -> WalletModel:
        wallet = _get_wallet(self.wallets, wallet_id, user=self.user)

        if data.name is not None:
            wallet.name = _validate_name(
                self.wallets, data.name, current=wallet, user=self.user
            )
        saved = _save(self.wallets, wallet)

        if data.current_balance is not None:
            current = self.wallets.balance(saved.id, user=self.user)
            difference = data.current_balance - current
            if difference:
                system = ensure_system_category(self.categories, self.user)
                self.transactions.save(
                    TransactionModel(
                        user=self.user,
                        wallet=saved,
                        category=system,
                        title=BALANCE_CORRECTION_TITLE,
                        amount=difference,
                        date=date.today(),
                    )
                )

        # Re-read so the response carries the annotated count and balance the
        # correction just produced.
        return self.wallets.find(saved.id, user=self.user) or saved


class DeleteWallet:
    """Delete a wallet; its transactions cascade away."""

    def __init__(self, wallets: WalletRepository, user: User):
        self.wallets = wallets
        self.user = user

    def execute(self, wallet_id: int) -> None:
        wallet = _get_wallet(self.wallets, wallet_id, user=self.user)
        self.wallets.delete(wallet)
