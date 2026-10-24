"""Counter entries record a moment (``occurred_at``) instead of a day (``date``).

Existing entries move to midnight UTC of their day.

Revision ID: 0006
Revises: 0005
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0006'
down_revision: str | None = '0005'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('counter_entries', schema=None) as batch_op:
        batch_op.add_column(sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=True))

    if op.get_bind().dialect.name == 'postgresql':
        op.execute("UPDATE counter_entries SET occurred_at = date::timestamp AT TIME ZONE 'UTC'")
    else:
        # SQLite keeps datetimes as naive UTC text in SQLAlchemy's format.
        op.execute("UPDATE counter_entries SET occurred_at = date || ' 00:00:00.000000'")

    with op.batch_alter_table('counter_entries', schema=None) as batch_op:
        batch_op.alter_column('occurred_at', existing_type=sa.DateTime(timezone=True), nullable=False)
        batch_op.drop_column('date')


def downgrade() -> None:
    with op.batch_alter_table('counter_entries', schema=None) as batch_op:
        batch_op.add_column(sa.Column('date', sa.Date(), nullable=True))

    if op.get_bind().dialect.name == 'postgresql':
        op.execute("UPDATE counter_entries SET date = (occurred_at AT TIME ZONE 'UTC')::date")
    else:
        op.execute('UPDATE counter_entries SET date = substr(occurred_at, 1, 10)')

    with op.batch_alter_table('counter_entries', schema=None) as batch_op:
        batch_op.alter_column('date', existing_type=sa.Date(), nullable=False)
        batch_op.drop_column('occurred_at')
