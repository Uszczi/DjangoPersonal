"""Expense tools: wallets, categories and transactions."""

from typing import Any, Literal

from personal import wiring
from personal.core.expenses import handlers as expense_handlers
from personal.core.expenses.contracts import (
    CategoryRequest,
    PatchedCategoryRequest,
    PatchedTransactionRequest,
    PatchedWalletRequest,
    TransactionRequest,
    WalletCreateRequest,
)

from ..serialization import (
    categories,
    category,
    transaction,
    transaction_page,
    wallet,
    wallets,
)
from .common import ToolContext, provided, tool, unit_of_work


@tool
def list_wallets(ctx: ToolContext) -> list[dict[str, Any]]:
    """List wallets with their balance and transaction count."""
    with unit_of_work(ctx) as (session, user):
        return wallets(expense_handlers.ListWallets(wiring.wallet_repository(session), user).execute())


@tool
def get_wallet(ctx: ToolContext, wallet_id: int) -> dict[str, Any]:
    """Fetch a single wallet by id."""
    with unit_of_work(ctx) as (session, user):
        handler = expense_handlers.GetWallet(wiring.wallet_repository(session), user)
        return wallet(handler.execute(wallet_id))


@tool
def create_wallet(
    ctx: ToolContext,
    name: str,
    color: str | None = None,
    icon: str | None = None,
    initial_balance: str | None = None,
) -> dict[str, Any]:
    """Create a wallet. ``color`` is ``#RRGGBB``, ``icon`` a lucide icon name,
    ``initial_balance`` a decimal string such as ``"120.50"``."""
    payload = WalletCreateRequest.model_validate(
        {'name': name, **provided(color=color, icon=icon, initial_balance=initial_balance)}
    )
    with unit_of_work(ctx) as (session, user):
        handler = expense_handlers.CreateWallet(
            wiring.wallet_repository(session),
            wiring.category_repository(session),
            wiring.transaction_repository(session),
            user,
        )
        return wallet(handler.execute(payload))


@tool
def update_wallet(
    ctx: ToolContext,
    wallet_id: int,
    name: str | None = None,
    color: str | None = None,
    icon: str | None = None,
    remove_icon: bool = False,
    current_balance: str | None = None,
) -> dict[str, Any]:
    """Update a wallet (partial). ``current_balance`` (decimal string) sets the
    balance by recording the difference as a System transaction; ``remove_icon``
    clears the icon."""
    fields = provided(name=name, color=color, icon=icon, current_balance=current_balance)
    if remove_icon:
        fields['icon'] = None
    payload = PatchedWalletRequest.model_validate(fields)
    with unit_of_work(ctx) as (session, user):
        handler = expense_handlers.UpdateWallet(
            wiring.wallet_repository(session),
            wiring.category_repository(session),
            wiring.transaction_repository(session),
            user,
        )
        return wallet(handler.execute(wallet_id, payload))


@tool
def delete_wallet(ctx: ToolContext, wallet_id: int) -> str:
    """Delete a wallet together with all its transactions."""
    with unit_of_work(ctx) as (session, user):
        expense_handlers.DeleteWallet(wiring.wallet_repository(session), user).execute(wallet_id)
        return 'deleted'


# --- expenses: categories ---------------------------------------------------


@tool
def list_categories(ctx: ToolContext) -> list[dict[str, Any]]:
    """List transaction categories."""
    with unit_of_work(ctx) as (session, user):
        handler = expense_handlers.ListCategories(wiring.category_repository(session), user)
        return categories(handler.execute())


@tool
def create_category(
    ctx: ToolContext,
    name: str,
    icon: str | None = None,
    kind: Literal['expense', 'income'] = 'expense',
) -> dict[str, Any]:
    """Create a category; ``icon`` is a lucide icon name and ``kind`` is
    ``expense`` or ``income``. The kind is fixed at creation and cannot change."""
    payload = CategoryRequest.model_validate({'name': name, **provided(icon=icon, kind=kind)})
    with unit_of_work(ctx) as (session, user):
        handler = expense_handlers.CreateCategory(wiring.category_repository(session), user)
        return category(handler.execute(payload))


@tool
def update_category(
    ctx: ToolContext, category_id: int, name: str | None = None, icon: str | None = None
) -> dict[str, Any]:
    """Update a category (partial)."""
    payload = PatchedCategoryRequest.model_validate(provided(name=name, icon=icon))
    with unit_of_work(ctx) as (session, user):
        handler = expense_handlers.UpdateCategory(wiring.category_repository(session), user)
        return category(handler.execute(category_id, payload))


@tool
def delete_category(ctx: ToolContext, category_id: int) -> str:
    """Delete a category together with all its transactions (system categories are refused)."""
    with unit_of_work(ctx) as (session, user):
        handler = expense_handlers.DeleteCategory(wiring.category_repository(session), user)
        handler.execute(category_id)
        return 'deleted'


# --- expenses: transactions -------------------------------------------------


@tool
def list_transactions(
    ctx: ToolContext,
    wallet_id: int,
    limit: int = expense_handlers.DEFAULT_PAGE_SIZE,
    cursor: str | None = None,
) -> dict[str, Any]:
    """List one page of a wallet's transactions, newest first.

    Returns ``{"items": [...], "next_cursor": ...}``; pass ``next_cursor`` back as
    ``cursor`` for the next page (``null`` means there is none). ``limit`` is 1–200.
    """
    with unit_of_work(ctx) as (session, user):
        handler = expense_handlers.ListTransactions(
            wiring.transaction_repository(session), wiring.wallet_repository(session), user
        )
        return transaction_page(handler.execute(wallet_id, limit=limit, cursor=cursor))


@tool
def create_transaction(
    ctx: ToolContext,
    wallet_id: int,
    title: str,
    amount: str,
    date: str,
    description: str = '',
    category_id: int | None = None,
) -> dict[str, Any]:
    """Record an expense or an income; the direction follows from the category's
    kind. ``amount`` is a positive decimal string (``"12.50"``), ``date`` is
    YYYY-MM-DD. Filing under the System category is refused."""
    payload = TransactionRequest.model_validate(
        {
            'wallet': wallet_id,
            'title': title,
            'amount': amount,
            'date': date,
            'description': description,
            'category': category_id,
        }
    )
    with unit_of_work(ctx) as (session, user):
        handler = expense_handlers.CreateTransaction(
            wiring.transaction_repository(session),
            wiring.wallet_repository(session),
            wiring.category_repository(session),
            user,
        )
        return transaction(handler.execute(payload))


@tool
def update_transaction(
    ctx: ToolContext,
    transaction_id: int,
    title: str | None = None,
    amount: str | None = None,
    date: str | None = None,
    description: str | None = None,
    category_id: int | None = None,
    clear_category: bool = False,
    wallet_id: int | None = None,
) -> dict[str, Any]:
    """Update a transaction (partial); ``clear_category`` uncategorizes it."""
    fields = provided(
        title=title,
        amount=amount,
        date=date,
        description=description,
        category=category_id,
        wallet=wallet_id,
    )
    if clear_category:
        fields['category'] = None
    payload = PatchedTransactionRequest.model_validate(fields)
    with unit_of_work(ctx) as (session, user):
        handler = expense_handlers.UpdateTransaction(
            wiring.transaction_repository(session),
            wiring.wallet_repository(session),
            wiring.category_repository(session),
            user,
        )
        return transaction(handler.execute(transaction_id, payload))


@tool
def delete_transaction(ctx: ToolContext, transaction_id: int) -> str:
    """Delete a transaction."""
    with unit_of_work(ctx) as (session, user):
        handler = expense_handlers.DeleteTransaction(wiring.transaction_repository(session), user)
        handler.execute(transaction_id)
        return 'deleted'
