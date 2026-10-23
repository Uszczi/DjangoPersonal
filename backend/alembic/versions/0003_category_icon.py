"""Category icon: a lucide icon name shown next to the category's name.

Existing categories get the default icon through the server default; the
seeded base categories and System get the icons new users are seeded with.
The names are copied here rather than imported, so the revision stays fixed.

Revision ID: 0003
Revises: 0002
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0003'
down_revision: str | None = '0002'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: Normalized (casefolded) base category names and their seeded icons.
SEEDED_ICONS = {
    'jedzenie': 'utensils',
    'mieszkanie': 'house',
    'transport': 'car',
    'zdrowie': 'heart-pulse',
    'rozrywka': 'gamepad-2',
    'zakupy': 'shopping-cart',
    'rachunki': 'receipt',
    'edukacja': 'graduation-cap',
    'podróże': 'plane',
    'system': 'settings',
}


def upgrade() -> None:
    with op.batch_alter_table('categories', schema=None) as batch_op:
        batch_op.add_column(sa.Column('icon', sa.String(length=64), server_default='tag', nullable=False))

    categories = sa.table('categories', sa.column('normalized_name', sa.String), sa.column('icon', sa.String))
    for name_key, icon in SEEDED_ICONS.items():
        op.execute(categories.update().where(categories.c.normalized_name == name_key).values(icon=icon))


def downgrade() -> None:
    with op.batch_alter_table('categories', schema=None) as batch_op:
        batch_op.drop_column('icon')
