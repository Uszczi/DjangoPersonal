"""Time entries get ``planned_end``: when a timer started with a limit stops by itself.

Revision ID: 0007
Revises: 0006
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0007'
down_revision: str | None = '0006'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('time_entries', schema=None) as batch_op:
        batch_op.add_column(sa.Column('planned_end', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('time_entries', schema=None) as batch_op:
        batch_op.drop_column('planned_end')
