"""The OpenAI-compatible answer model against a fake ``/chat/completions``."""

import json
from typing import Any

import httpx2
import pytest

from personal.core.notes_qa.ports import ModelUnavailable
from personal.infra.llm import OpenAICompatibleGenerator, UnconfiguredGenerator


def _client(handler: Any, **kwargs: Any) -> httpx2.Client:
    return httpx2.Client(
        transport=httpx2.MockTransport(handler), base_url='http://llm/v1', **kwargs
    )


def test_sends_the_system_and_user_messages_and_returns_the_reply() -> None:
    requests: list[httpx2.Request] = []

    def handler(request: httpx2.Request) -> httpx2.Response:
        requests.append(request)
        return httpx2.Response(
            200, json={'choices': [{'message': {'role': 'assistant', 'content': 'OC do marca [1].'}}]}
        )

    generator = OpenAICompatibleGenerator(
        _client(handler, headers={'Authorization': 'Bearer key'}), model='some-model'
    )

    reply = generator.generate(system='Zasady', prompt='Pytanie: kiedy OC?')

    assert reply == 'OC do marca [1].'
    [request] = requests
    assert request.url.path == '/v1/chat/completions'
    assert request.headers['Authorization'] == 'Bearer key'
    assert json.loads(request.content) == {
        'model': 'some-model',
        'messages': [
            {'role': 'system', 'content': 'Zasady'},
            {'role': 'user', 'content': 'Pytanie: kiedy OC?'},
        ],
        'temperature': 0.2,
        'stream': False,
    }


@pytest.mark.parametrize(
    'response',
    [
        httpx2.Response(404, json={'error': {'message': "model 'x' not found"}}),
        httpx2.Response(200, json={'choices': []}),
        httpx2.Response(200, json={'unexpected': True}),
        httpx2.Response(200, text='not json'),
    ],
)
def test_a_failed_or_odd_response_raises(response: httpx2.Response) -> None:
    generator = OpenAICompatibleGenerator(_client(lambda request: response), model='x')

    with pytest.raises(ModelUnavailable):
        generator.generate(system='s', prompt='p')


def test_an_unreachable_server_raises() -> None:
    def refuse(request: httpx2.Request) -> httpx2.Response:
        raise httpx2.ConnectError('connection refused', request=request)

    with pytest.raises(ModelUnavailable):
        OpenAICompatibleGenerator(_client(refuse), model='x').generate(system='s', prompt='p')


def test_without_a_model_answering_fails_clearly() -> None:
    with pytest.raises(ModelUnavailable, match='LLM_MODEL'):
        UnconfiguredGenerator().generate(system='s', prompt='p')
