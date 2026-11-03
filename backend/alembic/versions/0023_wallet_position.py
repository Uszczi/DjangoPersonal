"""Wallet position: the user's own order of their Wallets.

Existing wallets all start at 0, so they keep listing alphabetically (the
tie-break) until the user first moves one; that move numbers them all.

Revision ID: 0023
Revises: 0022
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0023'
down_revision: str | None = '0022'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('wallets', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('position', sa.Integer(), server_default='0', nullable=False)
        )


def downgrade() -> None:
    with op.batch_alter_table('wallets', schema=None) as batch_op:
        batch_op.drop_column('position')
