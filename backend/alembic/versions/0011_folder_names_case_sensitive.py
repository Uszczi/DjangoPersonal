"""Folder names: case matters, no spaces or "/", and no ``normalized_name``.

Names are unique among siblings by their exact text, so "Praca" and "praca" may
sit side by side, and listings sort by ``name``. Existing names lose their
spaces and slashes first: every run of them becomes "-" ("Klient A" → "Klient-A"),
and a clash this creates gets the first free "-2", "-3", … appended.

Revision ID: 0011
Revises: 0010
"""

import re
from collections.abc import Sequence

import sqlalchemy as sa
from alembic.operations import BatchOperations

from alembic import op

revision: str = '0011'
down_revision: str | None = '0010'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NAME_LENGTH = 100
FORBIDDEN = re.compile(r'[\s/]+')

folders = sa.table(
    'folders',
    sa.column('id', sa.Integer),
    sa.column('user_id', sa.Integer),
    sa.column('parent_id', sa.Integer),
    sa.column('name', sa.String),
    sa.column('normalized_name', sa.String),
)


def _clean_names() -> None:
    connection = op.get_bind()
    rows = connection.execute(
        sa.select(folders.c.id, folders.c.user_id, folders.c.parent_id, folders.c.name).order_by(
            folders.c.id
        )
    ).all()

    def clean(name: str) -> str:
        return FORBIDDEN.sub('-', name.strip()).strip('-') or 'Folder'

    # Names that need no change keep them; a renamed folder never steals one.
    taken: dict[tuple[int, int | None], set[str]] = {}
    for _, user_id, parent_id, name in rows:
        if clean(name) == name:
            taken.setdefault((user_id, parent_id), set()).add(name)
    for folder_id, user_id, parent_id, name in rows:
        base = clean(name)
        if base == name:
            continue
        used = taken.setdefault((user_id, parent_id), set())
        candidate, number = base, 1
        while candidate in used:
            number += 1
            suffix = f'-{number}'
            candidate = base[: NAME_LENGTH - len(suffix)] + suffix
        used.add(candidate)
        connection.execute(folders.update().where(folders.c.id == folder_id).values(name=candidate))


def _create_unique_indexes(batch_op: BatchOperations, column: str) -> None:
    batch_op.create_index(
        'folder_name_unique_at_top_level',
        ['user_id', column],
        unique=True,
        sqlite_where=sa.text('parent_id IS NULL'),
        postgresql_where=sa.text('parent_id IS NULL'),
    )
    batch_op.create_index(
        'folder_name_unique_per_parent',
        ['parent_id', column],
        unique=True,
        sqlite_where=sa.text('parent_id IS NOT NULL'),
        postgresql_where=sa.text('parent_id IS NOT NULL'),
    )


def upgrade() -> None:
    _clean_names()
    with op.batch_alter_table('folders', schema=None) as batch_op:
        batch_op.drop_index('folder_name_unique_per_parent')
        batch_op.drop_index('folder_name_unique_at_top_level')
        batch_op.drop_column('normalized_name')
        _create_unique_indexes(batch_op, 'name')


def downgrade() -> None:
    # Cleaned names stay cleaned. Fails if siblings now differ only in case.
    with op.batch_alter_table('folders', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('normalized_name', sa.String(length=100), nullable=False, server_default='')
        )
    connection = op.get_bind()
    for folder_id, name in connection.execute(sa.select(folders.c.id, folders.c.name)).all():
        connection.execute(
            folders.update()
            .where(folders.c.id == folder_id)
            .values(normalized_name=name.casefold())
        )
    with op.batch_alter_table('folders', schema=None) as batch_op:
        batch_op.alter_column('normalized_name', server_default=None)
        batch_op.drop_index('folder_name_unique_per_parent')
        batch_op.drop_index('folder_name_unique_at_top_level')
        _create_unique_indexes(batch_op, 'normalized_name')
