"""IndexNote: a Notatka's chunks follow its content, and only changed chunks are embedded."""

import pytest
from sqlalchemy.orm import Session

from personal.core.notes_qa.handlers import IndexNote
from personal.infra.models import User, Whiteboard
from personal.infra.repo import NoteChunkRepository, UserRepository, WhiteboardRepository
from tests.core.notes_qa.helpers import FakeEmbedder

CAR = "# Opony\n\nZimowe w listopadzie.\n\n# Ubezpieczenie\n\nOC do 14 marca.\n"


@pytest.fixture
def user(session: Session) -> User:
    return UserRepository(session).create(username='notes-user', password_hash='hash')


@pytest.fixture
def embedder() -> FakeEmbedder:
    return FakeEmbedder()


def _note(session: Session, user: User, markdown: str, name: str = 'Samochód') -> Whiteboard:
    return WhiteboardRepository(session).create(
        user=user, name=name, kind=Whiteboard.KIND_MARKDOWN, content={'markdown': markdown}
    )


def _edit(session: Session, note: Whiteboard, markdown: str) -> None:
    note.content = {'markdown': markdown}
    WhiteboardRepository(session).save(note)


def _index(session: Session, user: User, embedder: FakeEmbedder, note: Whiteboard) -> None:
    IndexNote(NoteChunkRepository(session), embedder, user).execute(note)


def _stored(session: Session, user: User, note: Whiteboard) -> list[tuple[str, str]]:
    return [
        (chunk.heading, chunk.text) for chunk in NoteChunkRepository(session).list_for(note, user=user)
    ]


def test_indexes_a_notatka_under_its_name(
    session: Session, user: User, embedder: FakeEmbedder
) -> None:
    note = _note(session, user, CAR)

    _index(session, user, embedder, note)

    chunks = NoteChunkRepository(session).list_for(note, user=user)
    assert [(chunk.heading, chunk.text) for chunk in chunks] == [
        ('Samochód / Opony', 'Zimowe w listopadzie.'),
        ('Samochód / Ubezpieczenie', 'OC do 14 marca.'),
    ]
    assert all(chunk.embedding_model == 'fake-embedder' for chunk in chunks)
    assert embedder.embedded == [
        'Samochód / Opony Zimowe w listopadzie.',
        'Samochód / Ubezpieczenie OC do 14 marca.',
    ]


def test_text_before_the_first_heading_is_titled_with_the_name_alone(
    session: Session, user: User, embedder: FakeEmbedder
) -> None:
    note = _note(session, user, 'Kupić płyn do spryskiwaczy.\n')

    _index(session, user, embedder, note)

    assert _stored(session, user, note) == [('Samochód', 'Kupić płyn do spryskiwaczy.')]


def test_a_first_heading_repeating_the_name_is_not_repeated_in_the_title(
    session: Session, user: User, embedder: FakeEmbedder
) -> None:
    note = _note(session, user, '# Samochód\n\n## Opony\n\nZimowe w listopadzie.\n')

    _index(session, user, embedder, note)

    assert _stored(session, user, note) == [('Samochód / Opony', 'Zimowe w listopadzie.')]


def test_an_unchanged_notatka_is_not_embedded_again(
    session: Session, user: User, embedder: FakeEmbedder
) -> None:
    note = _note(session, user, CAR)
    _index(session, user, embedder, note)
    embedder.embedded.clear()

    _index(session, user, embedder, note)

    assert embedder.embedded == []
    assert len(_stored(session, user, note)) == 2


def test_only_the_changed_section_is_embedded_again(
    session: Session, user: User, embedder: FakeEmbedder
) -> None:
    note = _note(session, user, CAR)
    _index(session, user, embedder, note)
    kept = NoteChunkRepository(session).list_for(note, user=user)[0].embedding
    embedder.embedded.clear()

    _edit(session, note, CAR.replace('OC do 14 marca.', 'OC do 20 marca.'))
    _index(session, user, embedder, note)

    assert embedder.embedded == ['Samochód / Ubezpieczenie OC do 20 marca.']
    chunks = NoteChunkRepository(session).list_for(note, user=user)
    assert [chunk.text for chunk in chunks] == ['Zimowe w listopadzie.', 'OC do 20 marca.']
    assert chunks[0].embedding == kept


def test_renaming_the_notatka_embeds_every_chunk_again(
    session: Session, user: User, embedder: FakeEmbedder
) -> None:
    note = _note(session, user, CAR)
    _index(session, user, embedder, note)
    embedder.embedded.clear()

    note.name = 'Auto'
    WhiteboardRepository(session).save(note)
    _index(session, user, embedder, note)

    assert embedder.embedded == [
        'Auto / Opony Zimowe w listopadzie.',
        'Auto / Ubezpieczenie OC do 14 marca.',
    ]


def test_a_new_model_embeds_every_chunk_again(
    session: Session, user: User, embedder: FakeEmbedder
) -> None:
    note = _note(session, user, CAR)
    _index(session, user, embedder, note)
    embedder.embedded.clear()

    embedder.model = 'fake-embedder-2'
    _index(session, user, embedder, note)

    assert len(embedder.embedded) == 2
    chunks = NoteChunkRepository(session).list_for(note, user=user)
    assert all(chunk.embedding_model == 'fake-embedder-2' for chunk in chunks)


def test_an_emptied_notatka_loses_its_chunks(
    session: Session, user: User, embedder: FakeEmbedder
) -> None:
    note = _note(session, user, CAR)
    _index(session, user, embedder, note)

    _edit(session, note, '')
    _index(session, user, embedder, note)

    assert _stored(session, user, note) == []


def test_a_drawing_gets_no_chunks(session: Session, user: User, embedder: FakeEmbedder) -> None:
    drawing = WhiteboardRepository(session).create(user=user, name='Szkic')

    _index(session, user, embedder, drawing)

    assert _stored(session, user, drawing) == []
    assert embedder.embedded == []
