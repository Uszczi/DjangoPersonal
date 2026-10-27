"""NoteChunkRepository: storing a Notatka's chunks and finding the closest ones.

``search`` has a path per database, so every test runs on SQLite and, when
``TEST_POSTGRES_HOST`` points at a Postgres with pgvector (``pgvector/pgvector:pg17``),
on Postgres too. The Postgres database is emptied after each test.
"""

import os
from collections.abc import Iterator

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from personal.infra import factories
from personal.infra.db import Database
from personal.infra.models import Base, NoteChunk, User, Whiteboard
from personal.infra.repo import NoteChunkRepository, UserRepository, WhiteboardRepository
from personal.settings import Settings

MODEL = 'test-model'
POSTGRES_LOCK_KEY = 4242


def _postgres_settings() -> Settings:
    host = os.environ.get('TEST_POSTGRES_HOST')
    if not host:
        pytest.skip('TEST_POSTGRES_HOST is not set')
    return Settings(
        postgres_host=host,
        postgres_port=int(os.environ.get('TEST_POSTGRES_PORT', '5432')),
        postgres_db=os.environ.get('TEST_POSTGRES_DB', 'test_db'),
        postgres_user=os.environ.get('TEST_POSTGRES_USER', 'app_user'),
        postgres_password=os.environ.get('TEST_POSTGRES_PASSWORD', 'test'),
    )


@pytest.fixture(params=['sqlite', 'postgresql'])
def session(request: pytest.FixtureRequest) -> Iterator[Session]:
    if request.param == 'sqlite':
        database: Database = request.getfixturevalue('database')
        with database.session_factory() as session:
            factories.bind_session(session)
            yield session
            factories.bind_session(None)
        return

    database = Database(_postgres_settings())
    # The xdist workers share this database, so its tests take turns.
    with database.engine.connect() as lock:
        lock.execute(text('SELECT pg_advisory_lock(:key)'), {'key': POSTGRES_LOCK_KEY})
        with database.engine.begin() as connection:
            connection.execute(text('CREATE EXTENSION IF NOT EXISTS vector'))
        Base.metadata.create_all(database.engine)
        try:
            with database.session_factory() as session:
                factories.bind_session(session)
                yield session
                factories.bind_session(None)
        finally:
            Base.metadata.drop_all(database.engine)
            lock.execute(text('SELECT pg_advisory_unlock(:key)'), {'key': POSTGRES_LOCK_KEY})
    database.dispose()


def _note(session: Session, user: User, name: str = 'Samochód') -> Whiteboard:
    return WhiteboardRepository(session).create(
        user=user, name=name, kind=Whiteboard.KIND_MARKDOWN
    )


def _chunk(text: str, embedding: list[float], model: str = MODEL) -> NoteChunk:
    return NoteChunk(
        heading=text,
        text=text,
        content_hash=f'hash-{text}',
        embedding_model=model,
        embedding=embedding,
    )


def test_replace_stores_the_chunks_in_order_and_drops_the_old_ones(
    session: Session, user: User
) -> None:
    chunks = NoteChunkRepository(session)
    note = _note(session, user)
    chunks.replace(note, [_chunk('a', [1.0, 0.0]), _chunk('b', [0.0, 1.0])])

    chunks.replace(note, [_chunk('c', [1.0, 1.0]), _chunk('d', [0.0, 1.0])])

    stored = chunks.list_for(note, user=user)
    assert [(chunk.position, chunk.text) for chunk in stored] == [(0, 'c'), (1, 'd')]
    assert all(chunk.user_id == user.id for chunk in stored)


def test_hashes_for_lists_the_hashes_of_one_model_in_order(session: Session, user: User) -> None:
    chunks = NoteChunkRepository(session)
    note = _note(session, user)
    chunks.replace(
        note,
        [_chunk('a', [1.0, 0.0]), _chunk('stale', [1.0, 0.0], model='old-model'), _chunk('b', [0.0, 1.0])],
    )

    assert chunks.hashes_for(note, user=user, model=MODEL) == ['hash-a', 'hash-b']
    assert chunks.hashes_for(note, user=user, model='other') == []


def test_search_returns_the_k_closest_chunks_best_first(session: Session, user: User) -> None:
    chunks = NoteChunkRepository(session)
    chunks.replace(
        _note(session, user),
        [_chunk('far', [0.0, 1.0]), _chunk('near', [1.0, 0.1]), _chunk('middle', [1.0, 1.0])],
    )

    found = chunks.search(user=user, vector=[1.0, 0.0], model=MODEL, k=2)

    assert [result.chunk.text for result in found] == ['near', 'middle']
    assert found[0].score > found[1].score
    assert round(found[1].score, 3) == 0.707


def test_search_sees_only_the_users_own_chunks(session: Session, user: User) -> None:
    other = UserRepository(session).create(username='other', password_hash='hash')
    chunks = NoteChunkRepository(session)
    chunks.replace(_note(session, other), [_chunk('theirs', [1.0, 0.0])])
    chunks.replace(_note(session, user), [_chunk('mine', [0.0, 1.0])])

    found = chunks.search(user=user, vector=[1.0, 0.0], model=MODEL, k=5)

    assert [result.chunk.text for result in found] == ['mine']


def test_search_skips_chunks_embedded_by_another_model(session: Session, user: User) -> None:
    chunks = NoteChunkRepository(session)
    chunks.replace(
        _note(session, user),
        [_chunk('stale', [1.0, 0.0], model='old-model'), _chunk('fresh', [0.0, 1.0])],
    )

    found = chunks.search(user=user, vector=[1.0, 0.0], model=MODEL, k=5)

    assert [result.chunk.text for result in found] == ['fresh']


def test_a_query_without_direction_finds_nothing(session: Session, user: User) -> None:
    chunks = NoteChunkRepository(session)
    chunks.replace(_note(session, user), [_chunk('a', [1.0, 0.0])])

    assert chunks.search(user=user, vector=[0.0, 0.0], model=MODEL, k=5) == []


def test_deleting_the_notatka_deletes_its_chunks(session: Session, user: User) -> None:
    chunks = NoteChunkRepository(session)
    note = _note(session, user)
    chunks.replace(note, [_chunk('a', [1.0, 0.0])])

    WhiteboardRepository(session).delete(note)
    session.expire_all()

    assert session.query(NoteChunk).count() == 0
