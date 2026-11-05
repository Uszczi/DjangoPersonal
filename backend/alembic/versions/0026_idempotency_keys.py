"""Idempotency keys: the stored answers to write requests a client may send again.

Revision ID: 0026
Revises: 0025
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0026'
down_revision: str | None = '0025'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'idempotency_keys',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('key', sa.String(length=255), nullable=False),
        sa.Column('method', sa.String(length=10), nullable=False),
        sa.Column('path', sa.String(length=500), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('content_type', sa.String(length=255), nullable=False),
        sa.Column('body', sa.LargeBinary(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['users.id'],
            name=op.f('fk_idempotency_keys_user_id_users'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_idempotency_keys')),
        sa.UniqueConstraint('user_id', 'key', name=op.f('uq_idempotency_keys_user_id_key')),
    )
    op.create_index(
        op.f('ix_idempotency_keys_created_at'), 'idempotency_keys', ['created_at'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_idempotency_keys_created_at'), table_name='idempotency_keys')
    op.drop_table('idempotency_keys')
