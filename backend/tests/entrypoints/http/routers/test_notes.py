"""POST /notes/ask/: questions about Notatki, with fake models behind the app."""

from collections.abc import Callable
from http import HTTPStatus
from typing import Any

import pytest
from fastapi import FastAPI

from personal.core.notes_qa.prompt import NOT_FOUND
from personal.settings import Settings
from tests.core.notes_qa.helpers import FakeAnswerGenerator, FakeEmbedder
from tests.harness import ApiClient

CAR = '# Samochód\n\n## Ubezpieczenie\n\nUbezpieczenie OC kończy się 14 marca.\n'


@pytest.fixture
def generator(app: FastAPI, settings: Settings) -> FakeAnswerGenerator:
    """Fake models on the app under test; the fake embedder's scores run low."""
    settings.notes_min_score = 0.3
    app.state.embedder = FakeEmbedder()
    generator = FakeAnswerGenerator('OC kończy się 14 marca [1].')
    app.state.answer_generator = generator
    return generator


def _note(post_json: Callable[[str, Any], Any], markdown: str) -> int:
    response = post_json(
        '/api/v1/whiteboards/',
        {'name': 'Samochód', 'kind': 'markdown', 'content': {'markdown': markdown}},
    )
    assert response.status_code == HTTPStatus.CREATED, response.json()
    note_id: int = response.json()['id']
    return note_id


def test_answers_with_the_cited_chunks(
    post_json: Any, generator: FakeAnswerGenerator
) -> None:
    note_id = _note(post_json, CAR)

    response = post_json('/api/v1/notes/ask/', {'question': 'Kiedy kończy się ubezpieczenie OC?'})

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body['answer'] == 'OC kończy się 14 marca [1].'
    [source] = body['sources']
    assert source['number'] == 1
    assert source['whiteboard_id'] == note_id
    assert source['heading'] == 'Samochód / Ubezpieczenie'
    assert source['text'] == 'Ubezpieczenie OC kończy się 14 marca.'


def test_says_so_when_the_notatki_do_not_answer(
    post_json: Any, generator: FakeAnswerGenerator
) -> None:
    _note(post_json, CAR)

    response = post_json('/api/v1/notes/ask/', {'question': 'Jaki jest przepis na pierogi?'})

    assert response.json() == {'answer': NOT_FOUND, 'sources': []}
    assert generator.calls == []


def test_without_an_answer_model_it_is_503(post_json: Any, app: FastAPI, settings: Settings) -> None:
    settings.notes_min_score = 0.3
    app.state.embedder = FakeEmbedder()
    _note(post_json, CAR)

    response = post_json('/api/v1/notes/ask/', {'question': 'Kiedy kończy się ubezpieczenie OC?'})

    assert response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
    assert 'LLM_MODEL' in response.json()['detail']


def test_a_blank_question_is_rejected(post_json: Any, generator: FakeAnswerGenerator) -> None:
    assert post_json('/api/v1/notes/ask/', {'question': '   '}).status_code == 422
    assert post_json('/api/v1/notes/ask/', {}).status_code == 422


def test_requires_authentication(anon_client: ApiClient) -> None:
    response = anon_client.post('/api/v1/notes/ask/', {'question': 'Kiedy OC?'})

    assert response.status_code == HTTPStatus.UNAUTHORIZED
