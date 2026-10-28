"""Bibliografia: Pozycje, the films and books a user tracks.

Revision ID: 0014
Revises: 0013
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0014'
down_revision: str | None = '0013'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('pozycje',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=10), nullable=False),
    sa.Column('title', sa.String(length=300), nullable=False),
    sa.Column('creator', sa.String(length=200), nullable=False),
    sa.Column('year', sa.Integer(), nullable=True),
    sa.Column('length', sa.Integer(), nullable=True),
    sa.Column('note', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("kind IN ('film', 'book')", name=op.f('ck_pozycje_kind')),
    sa.CheckConstraint('year IS NULL OR year > 0', name=op.f('ck_pozycje_year_positive')),
    sa.CheckConstraint('length IS NULL OR length > 0', name=op.f('ck_pozycje_length_positive')),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_pozycje_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_pozycje'))
    )
    with op.batch_alter_table('pozycje', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_pozycje_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('pozycje', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_pozycje_user_id'))

    op.drop_table('pozycje')
