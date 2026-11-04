from decimal import Decimal
from uuid import UUID

from sqlalchemy import ColumnElement, Numeric, Select, case, func, select, true
from sqlalchemy.orm import Session

from personal.infra.models import Category as CategoryModel
from personal.infra.models import Transaction as TransactionModel
from personal.infra.models import User
from personal.infra.models import Wallet as WalletModel

from ._flush import flush
from .errors import DuplicateWalletName

#: Money column shared by the balance expression and the response contract.
_MONEY = Numeric(10, 2)

#: A transaction's signed contribution to its wallet: System-category entries
#: (the opening balance and later corrections) add their signed amount, an
#: entry under an Income category adds, and anything else is an Expense and
#: subtracts. An uncategorized transaction is an Expense too.
_BALANCE: ColumnElement[Decimal] = func.coalesce(
    func.sum(
        case(
            (CategoryModel.is_system == true(), TransactionModel.amount),
            (CategoryModel.kind == CategoryModel.KIND_INCOME, TransactionModel.amount),
            else_=-TransactionModel.amount,
        )
    ),
    0,
    type_=_MONEY,
)


def _ledger(query: Select[WalletModel, int, Decimal]) -> Select[WalletModel, int, Decimal]:
    """Join each wallet to its transactions (and their categories) for the totals."""
    return (
        query.outerjoin(TransactionModel, TransactionModel.wallet_id == WalletModel.id)
        .outerjoin(CategoryModel, CategoryModel.id == TransactionModel.category_id)
        .group_by(WalletModel.id)
    )


class WalletRepository:
    """Every database access the ``expenses`` use cases need for wallets.

    Same contract as the other repositories: queries, writes and storage
    errors live here; the use cases own the rules about *what* to store.
    Every wallet it returns carries ``transaction_count`` and ``balance``.
    """

    def __init__(self, session: Session) -> None:
        self.session = session

    def _with_details(self, *conditions: ColumnElement[bool]) -> list[WalletModel]:
        query = _ledger(
            select(WalletModel, func.count(TransactionModel.id), _BALANCE).where(*conditions)
        ).order_by(WalletModel.position, WalletModel.normalized_name)
        wallets = []
        for wallet, count, balance in self.session.execute(query):
            wallet.transaction_count = count
            wallet.balance = balance
            wallets.append(wallet)
        return wallets

    def list_all(self, *, user: User) -> list[WalletModel]:
        """Every wallet for ``user`` in the user's order (then by name), with count and balance."""
        return self._with_details(WalletModel.user_id == user.id)

    def find(self, wallet_id: UUID, *, user: User) -> WalletModel | None:
        found = self._with_details(WalletModel.id == wallet_id, WalletModel.user_id == user.id)
        return found[0] if found else None

    def balance(self, wallet_id: UUID, *, user: User) -> Decimal:
        """The wallet's balance, computed from its ledger.

        Handlers read it through here rather than off a loaded wallet, so the
        value is never a stale copy.
        """
        wallet = self.find(wallet_id, user=user)
        return wallet.balance if wallet is not None else Decimal('0.00')

    def name_taken(
        self, name_key: str, *, user: User, exclude: WalletModel | None = None
    ) -> bool:
        query = select(WalletModel.id).where(
            WalletModel.normalized_name == name_key, WalletModel.user_id == user.id
        )
        if exclude is not None and exclude.id is not None:
            query = query.where(WalletModel.id != exclude.id)
        return self.session.scalars(query.limit(1)).first() is not None

    def save(self, wallet: WalletModel) -> WalletModel:
        """Persist a new or existing wallet, or fail on a name clash."""
        self.session.add(wallet)
        flush(self.session, on_conflict=DuplicateWalletName)
        return wallet

    def reorder(self, wallet: WalletModel, *, index: int | None) -> WalletModel:
        """Move ``wallet`` to ``index`` among the user's other wallets.

        ``index`` is clamped to the range and ``None`` appends at the end.
        Every wallet is renumbered to a gapless ``0..n-1``, so ordering stays
        predictable after any move.
        """
        query = (
            select(WalletModel)
            .where(WalletModel.user_id == wallet.user_id)
            .order_by(WalletModel.position, WalletModel.normalized_name)
        )
        if wallet.id is not None:
            query = query.where(WalletModel.id != wallet.id)
        siblings = list(self.session.scalars(query))
        target = len(siblings) if index is None else max(0, min(int(index), len(siblings)))
        siblings.insert(target, wallet)
        for position, sibling in enumerate(siblings):
            sibling.position = position
        self.session.flush()
        return wallet

    def delete(self, wallet: WalletModel) -> None:
        """Delete a wallet; its transactions cascade away in the database."""
        self.session.delete(wallet)
        self.session.flush()
