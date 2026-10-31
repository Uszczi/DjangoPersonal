"""Mobile settings: the mobile app's preferences (hidden tabs), one row per user.

Rows are created on first read, so existing users need no backfill.

Revision ID: 0021
Revises: 0020
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = '0021'
down_revision: str | None = '0020'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'mobile_settings',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column(
            'hidden_tabs',
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['users.id'],
            name=op.f('fk_mobile_settings_user_id_users'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('user_id', name=op.f('pk_mobile_settings')),
    )


def downgrade() -> None:
    op.drop_table('mobile_settings')
