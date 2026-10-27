"""What answering questions about Notatki needs from the outside world.

The use cases only see these protocols; the adapters (Ollama for embeddings, any
OpenAI-compatible server for answers) live in ``personal.infra``, so the models can change,
or be faked in tests, without touching the core.
"""

from typing import Protocol

from personal.core.notes_qa.chunking import SplitResult
from personal.core.shared.errors import DomainError


class Embedder(Protocol):
    """Turns text into vectors whose cosine similarity reflects closeness in meaning.

    Chunks and questions are embedded by separate methods because models such as
    EmbeddingGemma 2 are trained with different prefixes for each side; formatting them
    is the adapter's job. Vectors from different models are not comparable, so
    ``model`` is stored next to every chunk vector to tell when it is stale.
    """

    @property
    def model(self) -> str:
        """The name of the model the vectors come from."""
        ...

    def embed_documents(self, chunks: list[SplitResult]) -> list[list[float]]:
        """One vector per chunk, in order; ``heading_path`` should already start with the
        Notatka's name, since the adapter uses it as the chunk's title."""
        ...

    def embed_query(self, query: str) -> list[float]:
        """The vector of a question, comparable with :meth:`embed_documents` vectors."""
        ...


class AnswerGenerator(Protocol):
    """A chat model that writes the answer from the prompt :mod:`.prompt` builds.

    The rules of answering (only from the Chunks, cite them, say when nothing was found)
    are in that prompt, so they stay the same whichever model or provider is behind this.
    """

    def generate(self, *, system: str, prompt: str) -> str:
        """The model's reply to ``prompt`` under the ``system`` instructions."""
        ...


class ModelUnavailable(DomainError):
    """The embedding or chat model could not be reached, or refused the request.

    Raised by the adapters, so a question fails with a clear 503 instead of a 500.
    """

    code = 'model_unavailable'

    def __init__(self, message: str) -> None:
        super().__init__(message, status=503)
