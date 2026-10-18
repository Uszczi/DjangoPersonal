"""Persistence for wallets."""

from django.db import IntegrityError, transaction
from django.db.models import QuerySet

from apps.infra.models import Wallet as WalletModel
from apps.infra.models import User

from .errors import DuplicateWalletName


class WalletRepository:
    """Every database access the ``expenses`` app needs for wallets.

    Same contract as the other repositories: queries, writes and storage
    errors live here; the use cases own the rules about *what* to store.
    """

    def list_all(self, *, user: User) -> QuerySet[WalletModel]:
        """Every wallet for ``user``, alphabetically."""
        return WalletModel.objects.filter(user=user).order_by('normalized_name')

    def find(self, wallet_id: int, *, user: User) -> WalletModel | None:
        """The wallet with this id for ``user``, or ``None``."""
        return WalletModel.objects.filter(pk=wallet_id, user=user).first()

    def count(self, *, user: User) -> int:
        """How many wallets ``user`` has."""
        return WalletModel.objects.filter(user=user).count()

    def name_taken(
        self, name_key: str, *, user: User, exclude: WalletModel | None = None
    ) -> bool:
        """Whether another wallet already uses this normalized name."""
        duplicates = WalletModel.objects.filter(normalized_name=name_key, user=user)
        if exclude is not None:
            duplicates = duplicates.exclude(pk=exclude.pk)
        return duplicates.exists()

    def save(self, wallet: WalletModel) -> WalletModel:
        """Persist a new or existing wallet, or fail on a name clash."""
        try:
            with transaction.atomic():
                wallet.save()
        except IntegrityError as error:
            raise DuplicateWalletName from error
        return wallet

    def delete(self, wallet: WalletModel) -> None:
        """Delete a wallet; transactions cascade away at the database level."""
        wallet.delete()
