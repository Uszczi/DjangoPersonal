"""Bibliography: progress (page or minute) of an Attempt in progress.

Revision ID: 0016
Revises: 0015
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0016'
down_revision: str | None = '0015'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('bibliography_attempts', schema=None) as batch_op:
        batch_op.add_column(sa.Column('progress', sa.Integer(), nullable=True))
        batch_op.create_check_constraint(
            batch_op.f('ck_bibliography_attempts_progress_only_in_progress'),
            "progress IS NULL OR (progress >= 0 AND outcome = 'in_progress')",
        )


def downgrade() -> None:
    with op.batch_alter_table('bibliography_attempts', schema=None) as batch_op:
        batch_op.drop_constraint(
            batch_op.f('ck_bibliography_attempts_progress_only_in_progress'), type_='check'
        )
        batch_op.drop_column('progress')
