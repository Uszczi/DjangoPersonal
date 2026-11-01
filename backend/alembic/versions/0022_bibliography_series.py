"""Bibliography series: a BibliographyItem can be a series as well as a film or a book.

Only the kind's check constraint changes. Going back deletes the series and
their Attempts, which the older constraint cannot hold.

Revision ID: 0022
Revises: 0021
"""

from collections.abc import Sequence

from alembic import op

revision: str = '0022'
down_revision: str | None = '0021'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('bibliography_items', schema=None) as batch_op:
        batch_op.drop_constraint(op.f('ck_bibliography_items_kind'), type_='check')
        batch_op.create_check_constraint(
            op.f('ck_bibliography_items_kind'), "kind IN ('film', 'book', 'series')"
        )


def downgrade() -> None:
    op.execute(
        'DELETE FROM bibliography_attempts WHERE item_id IN '
        "(SELECT id FROM bibliography_items WHERE kind = 'series')"
    )
    op.execute("DELETE FROM bibliography_items WHERE kind = 'series'")
    with op.batch_alter_table('bibliography_items', schema=None) as batch_op:
        batch_op.drop_constraint(op.f('ck_bibliography_items_kind'), type_='check')
        batch_op.create_check_constraint(
            op.f('ck_bibliography_items_kind'), "kind IN ('film', 'book')"
        )
