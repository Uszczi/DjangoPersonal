"""Task comments and the files attached to them.

Attachments keep the original bytes in the database, so backups of the
database cover them and every download goes through the authenticated API.

Revision ID: 0018
Revises: 0017
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0018'
down_revision: str | None = '0017'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'task_comments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ['task_id'],
            ['tasks.id'],
            name=op.f('fk_task_comments_task_id_tasks'),
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['users.id'],
            name=op.f('fk_task_comments_user_id_users'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_task_comments')),
    )
    op.create_index(op.f('ix_task_comments_task_id'), 'task_comments', ['task_id'])
    op.create_index(op.f('ix_task_comments_user_id'), 'task_comments', ['user_id'])

    op.create_table(
        'comment_attachments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('comment_id', sa.Integer(), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('content_type', sa.String(length=127), nullable=False),
        sa.Column('size', sa.Integer(), nullable=False),
        sa.Column('data', sa.LargeBinary(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ['comment_id'],
            ['task_comments.id'],
            name=op.f('fk_comment_attachments_comment_id_task_comments'),
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['users.id'],
            name=op.f('fk_comment_attachments_user_id_users'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_comment_attachments')),
    )
    op.create_index(
        op.f('ix_comment_attachments_comment_id'), 'comment_attachments', ['comment_id']
    )
    op.create_index(op.f('ix_comment_attachments_user_id'), 'comment_attachments', ['user_id'])


def downgrade() -> None:
    op.drop_table('comment_attachments')
    op.drop_table('task_comments')
