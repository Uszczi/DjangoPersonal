"""Whiteboard and Notatka names are unique within a Folder; case matters.

Existing clashes are renamed first: in each Folder (and at the top level) the
oldest keeps its name and later ones get the first free " 2", " 3", … appended.
Names are trimmed too, as the models now do on every write.

Revision ID: 0010
Revises: 0009
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '0010'
down_revision: str | None = '0009'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NAME_LENGTH = 200


def _unique_names() -> None:
    """Rename duplicates so the unique indexes can be built."""
    connection = op.get_bind()
    boards = sa.table(
        'whiteboards',
        sa.column('id', sa.Integer),
        sa.column('user_id', sa.Integer),
        sa.column('folder_id', sa.Integer),
        sa.column('name', sa.String),
    )
    rows = connection.execute(
        sa.select(boards.c.id, boards.c.user_id, boards.c.folder_id, boards.c.name).order_by(
            boards.c.id
        )
    ).all()

    def clean(name: str | None) -> str:
        return (name or '').strip() or 'Bez tytułu'

    # Every name already in use stays reserved, so a new number never steals one.
    taken: dict[tuple[int, int | None], set[str]] = {}
    for _, user_id, folder_id, name in rows:
        taken.setdefault((user_id, folder_id), set()).add(clean(name))
    kept: set[tuple[int, int | None, str]] = set()
    for board_id, user_id, folder_id, name in rows:
        used = taken[(user_id, folder_id)]
        candidate = base = clean(name)
        if (user_id, folder_id, base) in kept:
            number = 1
            while candidate in used:
                number += 1
                suffix = f' {number}'
                candidate = base[: NAME_LENGTH - len(suffix)] + suffix
            used.add(candidate)
        kept.add((user_id, folder_id, candidate))
        if candidate != name:
            connection.execute(
                boards.update().where(boards.c.id == board_id).values(name=candidate)
            )


def upgrade() -> None:
    _unique_names()
    with op.batch_alter_table('whiteboards', schema=None) as batch_op:
        batch_op.create_index(
            'whiteboard_name_unique_at_top_level',
            ['user_id', 'name'],
            unique=True,
            sqlite_where=sa.text('folder_id IS NULL'),
            postgresql_where=sa.text('folder_id IS NULL'),
        )
        batch_op.create_index(
            'whiteboard_name_unique_per_folder',
            ['folder_id', 'name'],
            unique=True,
            sqlite_where=sa.text('folder_id IS NOT NULL'),
            postgresql_where=sa.text('folder_id IS NOT NULL'),
        )


def downgrade() -> None:
    # Renamed duplicates keep their new names.
    with op.batch_alter_table('whiteboards', schema=None) as batch_op:
        batch_op.drop_index('whiteboard_name_unique_per_folder')
        batch_op.drop_index('whiteboard_name_unique_at_top_level')
