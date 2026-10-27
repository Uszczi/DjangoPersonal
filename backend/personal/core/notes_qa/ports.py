"""What answering questions about Notatki needs from the outside world.

The use cases only see these protocols; the adapters (Ollama today) live in ``personal.infra``,
so the embedding model can change, or be faked in tests, without touching the core.
"""

from typing import Protocol

from personal.core.notes_qa.chunking import SplitResult


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
