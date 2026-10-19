"""Persistence for wallets."""

from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Case, Count, F, QuerySet, Sum, Value, When
from django.db.models.fields import DecimalField
from django.db.models.functions import Coalesce

from apps.infra.models import Wallet as WalletModel
from apps.infra.models import User

from .errors import DuplicateWalletName

#: Money column shared by the balance annotation and the response contract.
_MONEY = DecimalField(max_digits=10, decimal_places=2)

#: A transaction's signed contribution to its wallet: System-category entries
#: (the opening balance and later corrections) add to it, every other entry is
#: spending and subtracts. An uncategorized transaction is spending too.
_BALANCE = Coalesce(
    Sum(
        Case(
            When(transactions__category__is_system=True, then=F('transactions__amount')),
            default=-F('transactions__amount'),
            output_field=_MONEY,
        ),
        output_field=_MONEY,
    ),
    Value(Decimal('0.00'), output_field=_MONEY),
    output_field=_MONEY,
)


def _with_details(queryset: QuerySet[WalletModel]) -> QuerySet[WalletModel]:
    """Attach ``transaction_count`` and ``balance`` to every wallet row."""
    return queryset.annotate(
        transaction_count=Count('transactions'),
        balance=_BALANCE,
    )


class WalletRepository:
    """Every database access the ``expenses`` app needs for wallets.

    Same contract as the other repositories: queries, writes and storage
    errors live here; the use cases own the rules about *what* to store.
    """

    def list_all(self, *, user: User) -> QuerySet[WalletModel]:
        """Every wallet for ``user``, alphabetically, with count and balance."""
        return _with_details(WalletModel.objects.filter(user=user)).order_by(
            'normalized_name'
        )

    def find(self, wallet_id: int, *, user: User) -> WalletModel | None:
        """The wallet with this id for ``user``, or ``None``."""
        return _with_details(WalletModel.objects.filter(pk=wallet_id, user=user)).first()

    def balance(self, wallet_id: int, *, user: User) -> Decimal:
        """The wallet's balance, computed from its ledger.

        Handlers read it through here rather than off an annotated row, so the
        value is a plain, typed number and never a stale annotation.
        """
        totals = WalletModel.objects.filter(pk=wallet_id, user=user).aggregate(
            balance=_BALANCE
        )
        return totals['balance'] or Decimal('0.00')

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
