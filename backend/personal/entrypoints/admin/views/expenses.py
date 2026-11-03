"""Views for the Expenses domain (Wallets, Categories, Transactions)."""

from personal.infra.models import Category, Transaction, Wallet

from .base import _AppView


class WalletView(_AppView, model=Wallet):
    icon = 'fa-solid fa-wallet'
    column_list = [Wallet.id, Wallet.user, Wallet.name, Wallet.color]
    column_searchable_list = [Wallet.name]
    column_sortable_list = [Wallet.id, Wallet.name]
    form_columns = [Wallet.name]


class CategoryView(_AppView, model=Category):
    name_plural = 'Categories'
    icon = 'fa-solid fa-tags'
    can_edit = False
    can_delete = False
    column_list = [Category.id, Category.user, Category.name, Category.is_system]
    column_searchable_list = [Category.name]
    column_sortable_list = [Category.id, Category.name]


class TransactionView(_AppView, model=Transaction):
    icon = 'fa-solid fa-receipt'
    can_edit = False
    column_list = [
        Transaction.id,
        Transaction.user,
        Transaction.wallet,
        Transaction.date,
        Transaction.title,
        Transaction.amount,
        Transaction.category,
    ]
    column_searchable_list = [Transaction.title]
    column_sortable_list = [Transaction.id, Transaction.date, Transaction.amount]
