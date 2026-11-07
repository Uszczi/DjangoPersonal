"""Tags, which a user puts on Tasks across their Projects.

Revision ID: 0027
Revises: 0026
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0027'
down_revision: str | None = '0026'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('tags',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('name', sa.String(length=50), nullable=False),
    sa.Column('normalized_name', sa.String(length=50), nullable=False),
    sa.Column('color', sa.String(length=7), server_default='#477c7c', nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_tags_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_tags')),
    sa.UniqueConstraint('user_id', 'normalized_name', name='tag_name_unique_per_user')
    )
    with op.batch_alter_table('tags', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_tags_user_id'), ['user_id'], unique=False)

    op.create_table('task_tags',
    sa.Column('task_id', sa.Uuid(), nullable=False),
    sa.Column('tag_id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], name=op.f('fk_task_tags_tag_id_tags'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], name=op.f('fk_task_tags_task_id_tasks'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('task_id', 'tag_id', name=op.f('pk_task_tags'))
    )
    with op.batch_alter_table('task_tags', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_task_tags_tag_id'), ['tag_id'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('task_tags', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_task_tags_tag_id'))

    op.drop_table('task_tags')
    with op.batch_alter_table('tags', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_tags_user_id'))

    op.drop_table('tags')
