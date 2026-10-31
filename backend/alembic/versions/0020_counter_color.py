"""Counter colour: a ``#RRGGBB`` shown with the counter in the lists.

Existing counters get the default colour through the server default.

Revision ID: 0020
Revises: 0019
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0020'
down_revision: str | None = '0019'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('counters', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('color', sa.String(length=7), server_default='#477c7c', nullable=False)
        )


def downgrade() -> None:
    with op.batch_alter_table('counters', schema=None) as batch_op:
        batch_op.drop_column('color')
