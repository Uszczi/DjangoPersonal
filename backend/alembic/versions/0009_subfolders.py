"""Subfolders: a Folder may sit in another Folder.

Existing Folders stay at the top level. Names become unique among siblings
instead of across all of a user's Folders.

Revision ID: 0009
Revises: 0008
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0009'
down_revision: str | None = '0008'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('folders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('parent_id', sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f('ix_folders_parent_id'), ['parent_id'], unique=False)
        batch_op.create_foreign_key(
            batch_op.f('fk_folders_parent_id_folders'),
            'folders',
            ['parent_id'],
            ['id'],
            ondelete='CASCADE',
        )
        batch_op.drop_constraint('folder_name_unique_per_user', type_='unique')
        batch_op.create_index(
            'folder_name_unique_at_top_level',
            ['user_id', 'normalized_name'],
            unique=True,
            sqlite_where=sa.text('parent_id IS NULL'),
            postgresql_where=sa.text('parent_id IS NULL'),
        )
        batch_op.create_index(
            'folder_name_unique_per_parent',
            ['parent_id', 'normalized_name'],
            unique=True,
            sqlite_where=sa.text('parent_id IS NOT NULL'),
            postgresql_where=sa.text('parent_id IS NOT NULL'),
        )


def downgrade() -> None:
    # Flattening would break the per-user unique name, so subfolders go away.
    op.execute('DELETE FROM folders WHERE parent_id IS NOT NULL')
    with op.batch_alter_table('folders', schema=None) as batch_op:
        batch_op.drop_index('folder_name_unique_per_parent')
        batch_op.drop_index('folder_name_unique_at_top_level')
        batch_op.create_unique_constraint(
            'folder_name_unique_per_user', ['user_id', 'normalized_name']
        )
        batch_op.drop_constraint(batch_op.f('fk_folders_parent_id_folders'), type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_folders_parent_id'))
        batch_op.drop_column('parent_id')
