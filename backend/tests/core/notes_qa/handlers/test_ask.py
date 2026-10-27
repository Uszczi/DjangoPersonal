"""AskNotes: answers come only from the user's own, close enough Chunks."""

import pytest
from sqlalchemy.orm import Session

from personal.core.notes_qa.contracts import AskNotesRequest, NotesAnswer
from personal.core.notes_qa.handlers import AskNotes
from personal.core.notes_qa.prompt import NOT_FOUND, SYSTEM
from personal.infra.models import User, Whiteboard
from personal.infra.repo import NoteChunkRepository, UserRepository, WhiteboardRepository
from tests.core.notes_qa.helpers import FakeAnswerGenerator, FakeEmbedder

CAR = (
    '# Samochód\n\n## Opony\n\nWymiana opon na zimowe w listopadzie.\n\n'
    '## Ubezpieczenie\n\nUbezpieczenie OC kończy się 14 marca.\n'
)
#: The fake embedder only measures shared words, so its scores run lower than a model's.
MIN_SCORE = 0.3


@pytest.fixture
def user(session: Session) -> User:
    return UserRepository(session).create(username='asker', password_hash='hash')


def _note(session: Session, user: User, markdown: str, name: str = 'Samochód') -> Whiteboard:
    return WhiteboardRepository(session).create(
        user=user, name=name, kind=Whiteboard.KIND_MARKDOWN, content={'markdown': markdown}
    )


def _ask(
    session: Session,
    user: User,
    question: str,
    generator: FakeAnswerGenerator,
    *,
    min_score: float = MIN_SCORE,
) -> NotesAnswer:
    handler = AskNotes(
        WhiteboardRepository(session),
        NoteChunkRepository(session),
        FakeEmbedder(),
        generator,
        user,
        min_score=min_score,
    )
    return handler.execute(AskNotesRequest(question=question))


def test_answers_from_the_closest_chunks_and_cites_them(session: Session, user: User) -> None:
    note = _note(session, user, CAR)
    generator = FakeAnswerGenerator('OC kończy się 14 marca [1].')

    answer = _ask(session, user, 'Kiedy kończy się ubezpieczenie OC?', generator)

    assert answer.answer == 'OC kończy się 14 marca [1].'
    assert [(s.number, s.whiteboard_id, s.heading) for s in answer.sources] == [
        (1, note.id, 'Samochód / Ubezpieczenie')
    ]
    [(system, prompt)] = generator.calls
    assert system == SYSTEM
    assert prompt.startswith('<fragment numer="1" tytul="Samochód / Ubezpieczenie">')
    assert prompt.endswith('Pytanie: Kiedy kończy się ubezpieczenie OC?')


def test_nothing_close_enough_means_not_found_without_asking_the_model(
    session: Session, user: User
) -> None:
    _note(session, user, CAR)
    generator = FakeAnswerGenerator()

    answer = _ask(session, user, 'Jaki jest przepis na pierogi?', generator)

    assert answer == NotesAnswer(answer=NOT_FOUND, sources=[])
    assert generator.calls == []


def test_a_model_that_finds_nothing_cites_nothing(session: Session, user: User) -> None:
    _note(session, user, CAR)

    answer = _ask(session, user, 'Kiedy kończy się ubezpieczenie?', FakeAnswerGenerator(NOT_FOUND))

    assert answer == NotesAnswer(answer=NOT_FOUND, sources=[])


def test_only_the_cited_sources_are_returned_under_their_numbers(
    session: Session, user: User
) -> None:
    _note(session, user, CAR)

    answer = _ask(
        session, user, 'Opony i ubezpieczenie: kiedy wymiana, kiedy OC?',
        FakeAnswerGenerator('OC do 14 marca [2].'), min_score=0.0,
    )

    assert [source.number for source in answer.sources] == [2]


def test_an_answer_without_citations_keeps_every_source(session: Session, user: User) -> None:
    _note(session, user, CAR)

    answer = _ask(
        session, user, 'Opony i ubezpieczenie: kiedy wymiana, kiedy OC?',
        FakeAnswerGenerator('Opony w listopadzie, OC do marca.'), min_score=0.0,
    )

    assert [source.number for source in answer.sources] == [1, 2]


def test_a_new_notatka_is_indexed_before_the_question(session: Session, user: User) -> None:
    generator = FakeAnswerGenerator()
    assert _ask(session, user, 'Kiedy kończy się ubezpieczenie?', generator).sources == []

    _note(session, user, CAR)

    assert _ask(session, user, 'Kiedy kończy się ubezpieczenie?', generator).sources != []


def test_never_reads_another_users_notatki(session: Session, user: User) -> None:
    other = UserRepository(session).create(username='other', password_hash='hash')
    _note(session, other, CAR)
    generator = FakeAnswerGenerator()

    answer = _ask(session, user, 'Kiedy kończy się ubezpieczenie OC?', generator, min_score=0.0)

    assert answer.sources == []
    assert generator.calls == []
