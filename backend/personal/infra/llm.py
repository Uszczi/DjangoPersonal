"""The answer model behind any OpenAI-compatible chat completions API.

Ollama serves one at ``/v1``, and so do many hosted providers, so ``LLM_BASE_URL``,
``LLM_MODEL`` and ``LLM_API_KEY`` pick the model without a code change.
"""

import httpx2
from pydantic import BaseModel, ValidationError

from personal.core.notes_qa.ports import ModelUnavailable


class _Message(BaseModel):
    content: str


class _Choice(BaseModel):
    message: _Message


class _Completion(BaseModel):
    choices: list[_Choice]


class OpenAICompatibleGenerator:
    def __init__(self, client: httpx2.Client, model: str, temperature: float = 0.2) -> None:
        self._client = client
        self._model = model
        self._temperature = temperature

    def generate(self, *, system: str, prompt: str) -> str:
        try:
            response = self._client.post(
                '/chat/completions',
                json={
                    'model': self._model,
                    'messages': [
                        {'role': 'system', 'content': system},
                        {'role': 'user', 'content': prompt},
                    ],
                    'temperature': self._temperature,
                    'stream': False,
                },
            )
            response.raise_for_status()
            completion = _Completion.model_validate(response.json())
        except (httpx2.HTTPError, ValidationError, ValueError) as error:
            raise ModelUnavailable(f'The answer model failed: {error}') from error
        if not completion.choices:
            raise ModelUnavailable('The answer model returned no answer.')
        return completion.choices[0].message.content


class UnconfiguredGenerator:
    """Stands in when ``LLM_MODEL`` is unset: Chunks are still indexed and searched, but
    there is nothing to write the answer."""

    def generate(self, *, system: str, prompt: str) -> str:
        raise ModelUnavailable('No answer model is configured (LLM_MODEL).')
