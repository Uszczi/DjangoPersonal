from personal import wiring
from personal.infra.ollama import OllamaEmbedder
from personal.infra.rate_limit import InMemoryRateLimiter, RedisRateLimiter
from personal.settings import Settings


def test_the_rate_limiter_counts_in_memory_without_redis() -> None:
    assert isinstance(wiring.rate_limiter(Settings(redis_url=None)), InMemoryRateLimiter)


def test_the_rate_limiter_counts_in_redis_when_redis_url_is_set() -> None:
    limiter = wiring.rate_limiter(Settings(redis_url='redis://redis:6379/0'))

    assert isinstance(limiter, RedisRateLimiter)


    embedder = wiring.embedder(Settings(ollama_url='http://ollama:11434', embedding_model='bge-m3'))

    assert isinstance(embedder, OllamaEmbedder)
    assert embedder.model == 'bge-m3'
