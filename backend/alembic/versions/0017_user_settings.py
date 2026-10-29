"""User settings: the account's preferences (the theme), one row per user.

Rows are created on first read, so existing users need no backfill.

Revision ID: 0017
Revises: 0016
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0017'
down_revision: str | None = '0016'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'user_settings',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('theme', sa.String(length=32), nullable=False),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['users.id'],
            name=op.f('fk_user_settings_user_id_users'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('user_id', name=op.f('pk_user_settings')),
    )


def downgrade() -> None:
    op.drop_table('user_settings')
