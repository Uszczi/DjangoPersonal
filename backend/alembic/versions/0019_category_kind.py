"""Category kind: every category is an Expense or an Income one.

Existing categories (the System one included, whose kind is ignored) become
Expense categories through the server default. Transactions are not touched,
and existing users get no Income categories: they add them by hand.

Revision ID: 0019
Revises: 0018
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0019'
down_revision: str | None = '0018'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('categories', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('kind', sa.String(length=10), server_default='expense', nullable=False)
        )
        batch_op.create_check_constraint(
            op.f('ck_categories_kind'), "kind IN ('expense', 'income')"
        )


def downgrade() -> None:
    with op.batch_alter_table('categories', schema=None) as batch_op:
        batch_op.drop_constraint(op.f('ck_categories_kind'), type_='check')
        batch_op.drop_column('kind')
