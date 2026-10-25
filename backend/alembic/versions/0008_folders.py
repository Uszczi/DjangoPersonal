"""Folders: single-level groups of Whiteboards and Notatki in the Notatnik.

Revision ID: 0008
Revises: 0007
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0008'
down_revision: str | None = '0007'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('folders',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('normalized_name', sa.String(length=100), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_folders_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_folders')),
    sa.UniqueConstraint('user_id', 'normalized_name', name='folder_name_unique_per_user')
    )
    with op.batch_alter_table('folders', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_folders_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('folders', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_folders_user_id'))

    op.drop_table('folders')
