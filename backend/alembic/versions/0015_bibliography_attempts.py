"""Bibliography: Attempts, each watch or read of a BibliographyItem.

Revision ID: 0015
Revises: 0014
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0015'
down_revision: str | None = '0014'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('bibliography_attempts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('item_id', sa.Integer(), nullable=False),
    sa.Column('outcome', sa.String(length=20), nullable=False),
    sa.Column('started_on', sa.Date(), nullable=True),
    sa.Column('ended_on', sa.Date(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("outcome IN ('in_progress', 'finished', 'abandoned')", name=op.f('ck_bibliography_attempts_outcome')),
    sa.CheckConstraint("(outcome = 'in_progress') = (ended_on IS NULL)", name=op.f('ck_bibliography_attempts_ended_on_iff_ended')),
    sa.CheckConstraint('started_on IS NULL OR ended_on IS NULL OR ended_on >= started_on', name=op.f('ck_bibliography_attempts_ends_after_start')),
    sa.ForeignKeyConstraint(['item_id'], ['bibliography_items.id'], name=op.f('fk_bibliography_attempts_item_id_items'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_bibliography_attempts_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_bibliography_attempts'))
    )
    with op.batch_alter_table('bibliography_attempts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_bibliography_attempts_item_id'), ['item_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_bibliography_attempts_user_id'), ['user_id'], unique=False)
        batch_op.create_index('uq_bibliography_attempts_one_in_progress', ['item_id'], unique=True, sqlite_where=sa.text("outcome = 'in_progress'"), postgresql_where=sa.text("outcome = 'in_progress'"))


def downgrade() -> None:
    with op.batch_alter_table('bibliography_attempts', schema=None) as batch_op:
        batch_op.drop_index('uq_bibliography_attempts_one_in_progress', sqlite_where=sa.text("outcome = 'in_progress'"), postgresql_where=sa.text("outcome = 'in_progress'"))
        batch_op.drop_index(batch_op.f('ix_bibliography_attempts_user_id'))
        batch_op.drop_index(batch_op.f('ix_bibliography_attempts_item_id'))

    op.drop_table('bibliography_attempts')
