"""The ask_notes tool."""

import pytest
from mcp.server.fastmcp.exceptions import ToolError

from personal.entrypoints.mcp import runtime
from personal.infra.llm import UnconfiguredGenerator
from personal.infra.models import User
from tests.core.notes_qa.helpers import FakeAnswerGenerator, FakeEmbedder
from tests.entrypoints.mcp.helpers import call


def test_ask_notes_answers_from_the_notatki(
    mcp_user: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(runtime, 'embedder', FakeEmbedder())
    monkeypatch.setattr(runtime, 'answer_generator', FakeAnswerGenerator('Do 14 marca [1].'))
    monkeypatch.setattr(runtime.settings, 'notes_min_score', 0.3)
    note = call(
        'create_whiteboard',
        name='Samochód',
        kind='markdown',
        markdown='# Ubezpieczenie\n\nUbezpieczenie OC kończy się 14 marca.\n',
    )

    result = call('ask_notes', question='Kiedy kończy się ubezpieczenie OC?')

    assert result['answer'] == 'Do 14 marca [1].'
    assert [(s['number'], s['whiteboard_id']) for s in result['sources']] == [(1, note['id'])]


def test_ask_notes_without_an_answer_model_is_a_tool_error(
    mcp_user: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(runtime, 'embedder', FakeEmbedder())
    monkeypatch.setattr(runtime, 'answer_generator', UnconfiguredGenerator())
    monkeypatch.setattr(runtime.settings, 'notes_min_score', 0.3)
    call('create_whiteboard', name='Samochód', kind='markdown', markdown='Ubezpieczenie OC kończy się 14 marca.')

    with pytest.raises(ToolError, match='LLM_MODEL'):
        call('ask_notes', question='Kiedy kończy się ubezpieczenie OC?')
