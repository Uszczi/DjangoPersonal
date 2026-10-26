"""Composite ``(wallet_id, date, id)`` index for the keyset-paged transaction list.

It replaces the single-column ``wallet_id`` index, which is its leading prefix.

Revision ID: 0012
Revises: 0011
"""

from collections.abc import Sequence

from alembic import op

revision: str = '0012'
down_revision: str | None = '0011'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        'ix_transactions_wallet_id_date_id',
        'transactions',
        ['wallet_id', 'date', 'id'],
        unique=False,
    )
    op.drop_index('ix_transactions_wallet_id', table_name='transactions')


def downgrade() -> None:
    op.create_index('ix_transactions_wallet_id', 'transactions', ['wallet_id'], unique=False)
    op.drop_index('ix_transactions_wallet_id_date_id', table_name='transactions')
