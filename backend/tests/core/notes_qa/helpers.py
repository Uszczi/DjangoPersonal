import hashlib
import re

from personal.core.notes_qa.chunking import SplitResult

DIMENSIONS = 64


class FakeEmbedder:
    model = "fake-embedder"

    def __init__(self) -> None:
        self.embedded: list[str] = []

    def embed_documents(self, chunks: list[SplitResult]) -> list[list[float]]:
        texts = [f"{chunk.heading_path} {chunk.text}" for chunk in chunks]
        self.embedded.extend(texts)
        return [_vector(text) for text in texts]

    def embed_query(self, query: str) -> list[float]:
        return _vector(query)


def _vector(text: str) -> list[float]:
    vector = [0.0] * DIMENSIONS
    for word in re.findall(r"\w+", text.lower()):
        digest = hashlib.blake2b(word.encode(), digest_size=4).digest()
        vector[int.from_bytes(digest) % DIMENSIONS] += 1.0
    return vector


class FakeAnswerGenerator:
    """Replies with ``reply`` and records every prompt it was given."""

    def __init__(self, reply: str = 'Odpowiedź [1].') -> None:
        self.reply = reply
        self.calls: list[tuple[str, str]] = []

    def generate(self, *, system: str, prompt: str) -> str:
        self.calls.append((system, prompt))
        return self.reply
