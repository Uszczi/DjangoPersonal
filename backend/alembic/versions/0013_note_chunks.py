"""Note chunks: the embedded fragments of Notatki that answering questions searches.

Revision ID: 0013
Revises: 0012
"""

from collections.abc import Sequence

import sqlalchemy as sa
from pgvector.sqlalchemy import VECTOR

from alembic import op

revision: str = '0013'
down_revision: str | None = '0012'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if op.get_bind().dialect.name == 'postgresql':
        # Needs the pgvector image (``pgvector/pgvector:pg17``) and a superuser, which the
        # image's ``POSTGRES_USER`` is. Kept on downgrade: dropping it is a DBA's call.
        op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    op.create_table('note_chunks',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('whiteboard_id', sa.Integer(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('heading', sa.Text(), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('content_hash', sa.String(length=64), nullable=False),
    sa.Column('embedding_model', sa.String(length=100), nullable=False),
    sa.Column('embedding', sa.JSON().with_variant(VECTOR(), 'postgresql'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_note_chunks_user_id_users'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['whiteboard_id'], ['whiteboards.id'], name=op.f('fk_note_chunks_whiteboard_id_whiteboards'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_note_chunks')),
    sa.UniqueConstraint('whiteboard_id', 'position', name=op.f('uq_note_chunks_whiteboard_id_position'))
    )
    with op.batch_alter_table('note_chunks', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_note_chunks_user_id'), ['user_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_note_chunks_whiteboard_id'), ['whiteboard_id'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('note_chunks', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_note_chunks_whiteboard_id'))
        batch_op.drop_index(batch_op.f('ix_note_chunks_user_id'))

    op.drop_table('note_chunks')
