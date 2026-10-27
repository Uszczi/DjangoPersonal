import json
from typing import Any

import httpx2
import pytest

from personal.core.notes_qa.chunking import SplitResult
from personal.core.notes_qa.ports import ModelUnavailable
from personal.infra.ollama import OllamaEmbedder

MODEL = "embeddinggemma-2"


class FakeOllama:
    def __init__(self, status_code: int = 200) -> None:
        self.requests: list[dict[str, Any]] = []
        self.status_code = status_code
        self._seen = 0

    def handler(self, request: httpx2.Request) -> httpx2.Response:
        assert request.method == "POST"
        assert request.url.path == "/api/embed"
        body = json.loads(request.content)
        self.requests.append(body)
        if self.status_code != 200:
            return httpx2.Response(self.status_code, json={"error": "boom"})
        start = self._seen
        self._seen += len(body["input"])
        return httpx2.Response(
            200, json={"model": body["model"], "embeddings": [[float(start + i)] for i in range(len(body["input"]))]}
        )

    def client(self) -> httpx2.Client:
        return httpx2.Client(transport=httpx2.MockTransport(self.handler), base_url="http://ollama")


@pytest.fixture
def ollama() -> FakeOllama:
    return FakeOllama()


def test_a_chunk_is_sent_with_the_title_and_text_prefix(ollama: FakeOllama) -> None:
    embedder = OllamaEmbedder(ollama.client(), model=MODEL)

    embedder.embed_documents([SplitResult(heading_path="Samochód / Opony", text="Zimowe w listopadzie.")])

    assert ollama.requests[0]["input"] == ["title: Samochód / Opony | text: Zimowe w listopadzie."]


def test_a_query_is_sent_with_the_search_task_prefix(ollama: FakeOllama) -> None:
    embedder = OllamaEmbedder(ollama.client(), model=MODEL)

    vector = embedder.embed_query("Kiedy zmienić opony?")

    assert ollama.requests[0]["input"] == ["task: search result | query: Kiedy zmienić opony?"]
    assert vector == [0.0]


def test_chunks_are_sent_in_batches(ollama: FakeOllama) -> None:
    embedder = OllamaEmbedder(ollama.client(), model=MODEL, batch_size=2)
    chunks = [SplitResult(heading_path="N", text=f"chunk {i}") for i in range(3)]

    embedder.embed_documents(chunks)

    assert [len(body["input"]) for body in ollama.requests] == [2, 1]


def test_vectors_come_back_in_chunk_order_across_batches(ollama: FakeOllama) -> None:
    embedder = OllamaEmbedder(ollama.client(), model=MODEL, batch_size=2)
    chunks = [SplitResult(heading_path="N", text=f"chunk {i}") for i in range(3)]

    vectors = embedder.embed_documents(chunks)

    assert vectors == [[0.0], [1.0], [2.0]]


def test_no_chunks_means_no_request(ollama: FakeOllama) -> None:
    embedder = OllamaEmbedder(ollama.client(), model=MODEL)

    assert embedder.embed_documents([]) == []
    assert ollama.requests == []


def test_every_request_names_the_model_and_never_truncates(ollama: FakeOllama) -> None:
    embedder = OllamaEmbedder(ollama.client(), model=MODEL, batch_size=1)

    embedder.embed_documents([SplitResult(heading_path="N", text="a"), SplitResult(heading_path="N", text="b")])
    embedder.embed_query("q")

    assert len(ollama.requests) == 3
    assert all(body["model"] == MODEL and body["truncate"] is False for body in ollama.requests)
    assert embedder.model == MODEL


def test_an_error_response_raises() -> None:
    failing = FakeOllama(status_code=500)
    embedder = OllamaEmbedder(failing.client(), model=MODEL)

    with pytest.raises(ModelUnavailable):
        embedder.embed_query("q")


def test_an_unreachable_server_raises() -> None:
    def refuse(request: httpx2.Request) -> httpx2.Response:
        raise httpx2.ConnectError("connection refused", request=request)

    client = httpx2.Client(transport=httpx2.MockTransport(refuse), base_url="http://ollama")

    with pytest.raises(ModelUnavailable):
        OllamaEmbedder(client, model=MODEL).embed_query("q")


def test_fewer_vectors_than_inputs_raises() -> None:
    def short(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={"embeddings": [[1.0]]})

    client = httpx2.Client(transport=httpx2.MockTransport(short), base_url="http://ollama")
    chunks = [SplitResult(heading_path="N", text="a"), SplitResult(heading_path="N", text="b")]

    with pytest.raises(ModelUnavailable):
        OllamaEmbedder(client, model=MODEL).embed_documents(chunks)
