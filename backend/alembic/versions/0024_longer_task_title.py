"""Longer Task titles: up to 1000 characters instead of 200.

Revision ID: 0024
Revises: 0023
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0024'
down_revision: str | None = '0023'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('tasks', schema=None) as batch_op:
        batch_op.alter_column(
            'title',
            existing_type=sa.String(length=200),
            type_=sa.String(length=1000),
            existing_nullable=False,
        )


def downgrade() -> None:
    # Titles longer than 200 characters are cut to fit the old column.
    op.execute('UPDATE tasks SET title = substr(title, 1, 200) WHERE length(title) > 200')
    with op.batch_alter_table('tasks', schema=None) as batch_op:
        batch_op.alter_column(
            'title',
            existing_type=sa.String(length=1000),
            type_=sa.String(length=200),
            existing_nullable=False,
        )
