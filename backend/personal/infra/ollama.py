from itertools import batched

import httpx2
from pydantic import BaseModel, ValidationError

from personal.core.notes_qa.chunking import SplitResult
from personal.core.notes_qa.ports import ModelUnavailable


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]


class OllamaEmbedder:
    def __init__(self, client: httpx2.Client, model: str, batch_size: int = 32) -> None:
        self._client = client
        self._model = model
        self._batch_size = batch_size

    @property
    def model(self) -> str:
        return self._model

    def embed_documents(self, chunks: list[SplitResult]) -> list[list[float]]:
        texts = [f"title: {chunk.heading_path} | text: {chunk.text}" for chunk in chunks]
        vectors: list[list[float]] = []
        for batch in batched(texts, self._batch_size):
            vectors.extend(self._embed(list(batch)))
        return vectors

    def embed_query(self, query: str) -> list[float]:
        return self._embed([f"task: search result | query: {query}"])[0]

    def _embed(self, inputs: list[str]) -> list[list[float]]:
        try:
            response = self._client.post(
                "/api/embed", json={"model": self._model, "input": inputs, "truncate": False}
            )
            response.raise_for_status()
            embeddings = EmbedResponse.model_validate(response.json()).embeddings
        except (httpx2.HTTPError, ValidationError, ValueError) as error:
            raise ModelUnavailable(f"The embedding model failed: {error}") from error
        # Fewer vectors than inputs would silently give chunks each other's vectors.
        if len(embeddings) != len(inputs):
            raise ModelUnavailable(
                f"The embedding model returned {len(embeddings)} vectors for {len(inputs)} inputs."
            )
        return embeddings
