"""The schema revisions the API reports at startup."""

from pathlib import Path

from sqlalchemy import create_engine

from personal.infra import schema


def test_the_code_revision_is_the_newest_migration() -> None:
    newest = max(path.name[:4] for path in (schema.ALEMBIC_DIR / 'versions').glob('0*.py'))

    assert schema.code_revision() == newest


def test_an_unmigrated_database_has_no_revision(tmp_path: Path) -> None:
    engine = create_engine(f'sqlite:///{tmp_path / "empty.sqlite3"}')

    assert schema.database_revision(engine) == schema.UNKNOWN
