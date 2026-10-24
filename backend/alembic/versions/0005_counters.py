"""Counters: named tallies and the entries added to them.

Revision ID: 0005
Revises: 0004
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0005'
down_revision: str | None = '0004'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('counters',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_counters_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_counters'))
    )
    with op.batch_alter_table('counters', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_counters_user_id'), ['user_id'], unique=False)

    op.create_table('counter_entries',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('counter_id', sa.Integer(), nullable=False),
    sa.Column('value', sa.Integer(), nullable=False),
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('note', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['counter_id'], ['counters.id'], name=op.f('fk_counter_entries_counter_id_counters'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_counter_entries_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_counter_entries'))
    )
    with op.batch_alter_table('counter_entries', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_counter_entries_counter_id'), ['counter_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_counter_entries_user_id'), ['user_id'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('counter_entries', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_counter_entries_user_id'))
        batch_op.drop_index(batch_op.f('ix_counter_entries_counter_id'))

    op.drop_table('counter_entries')
    with op.batch_alter_table('counters', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_counters_user_id'))

    op.drop_table('counters')
