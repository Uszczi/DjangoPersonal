"""Composition root: builds what the use cases run against.

Every provider is a plain function of the current unit of work's ``Session``
(one request or one tool call) or of the ``Settings``, and returns a *fresh*
object, so one that later grows state cannot leak it between requests. All
entrypoints share it: the HTTP API wraps the providers as FastAPI dependencies
(``personal.entrypoints.http.deps``), the MCP server, the admin panel and the
CLI call them directly. This is also the single place to swap the concrete
implementation: a fake in a unit test, a caching wrapper in production.
"""

import httpx2
import redis
from sqlalchemy.orm import Session

from personal.core.accounts.ports import (
    InvalidToken,
    PasswordHasher,
    PasswordPolicy,
    RateLimiter,
    TokenService,
)
from personal.core.notes_qa.ports import AnswerGenerator, Embedder
from personal.infra.llm import OpenAICompatibleGenerator, UnconfiguredGenerator
from personal.infra.models import User
from personal.infra.ollama import OllamaEmbedder
from personal.infra.rate_limit import InMemoryRateLimiter, RedisRateLimiter
from personal.infra.repo import (
    AttemptRepository,
    BibliographyItemRepository,
    CategoryRepository,
    CommentAttachmentRepository,
    CounterEntryRepository,
    CounterRepository,
    FolderRepository,
    MobileSettingsRepository,
    NoteChunkRepository,
    ProjectRepository,
    TaskCommentRepository,
    TaskRepository,
    TimeEntryRepository,
    TransactionRepository,
    UserRepository,
    UserSettingsRepository,
    WalletRepository,
    WhiteboardRepository,
)
from personal.infra.security import JwtTokenService, ScryptPasswordHasher, SimplePasswordPolicy
from personal.settings import Settings


def user_repository(session: Session) -> UserRepository:
    return UserRepository(session)


def user_settings_repository(session: Session) -> UserSettingsRepository:
    return UserSettingsRepository(session)


def mobile_settings_repository(session: Session) -> MobileSettingsRepository:
    return MobileSettingsRepository(session)


def project_repository(session: Session) -> ProjectRepository:
    return ProjectRepository(session)


def task_repository(session: Session) -> TaskRepository:
    return TaskRepository(session)


def task_comment_repository(session: Session) -> TaskCommentRepository:
    return TaskCommentRepository(session)


def comment_attachment_repository(session: Session) -> CommentAttachmentRepository:
    return CommentAttachmentRepository(session)


def time_entry_repository(session: Session) -> TimeEntryRepository:
    return TimeEntryRepository(session)


def whiteboard_repository(session: Session) -> WhiteboardRepository:
    return WhiteboardRepository(session)


def note_chunk_repository(session: Session) -> NoteChunkRepository:
    return NoteChunkRepository(session)


def folder_repository(session: Session) -> FolderRepository:
    return FolderRepository(session)


def wallet_repository(session: Session) -> WalletRepository:
    return WalletRepository(session)


def category_repository(session: Session) -> CategoryRepository:
    return CategoryRepository(session)


def transaction_repository(session: Session) -> TransactionRepository:
    return TransactionRepository(session)


def counter_repository(session: Session) -> CounterRepository:
    return CounterRepository(session)


def counter_entry_repository(session: Session) -> CounterEntryRepository:
    return CounterEntryRepository(session)


def bibliography_item_repository(session: Session) -> BibliographyItemRepository:
    return BibliographyItemRepository(session)


def attempt_repository(session: Session) -> AttemptRepository:
    return AttemptRepository(session)


def password_hasher() -> PasswordHasher:
    return ScryptPasswordHasher()


def password_policy() -> PasswordPolicy:
    return SimplePasswordPolicy()


def token_service(settings: Settings) -> TokenService:
    return JwtTokenService(
        secret_key=settings.secret_key,
        access_lifetime=settings.access_token_lifetime,
        refresh_lifetime=settings.refresh_token_lifetime,
    )


def rate_limiter(settings: Settings) -> RateLimiter:
    if settings.redis_url:
        return RedisRateLimiter(redis.Redis.from_url(settings.redis_url))
    return InMemoryRateLimiter()


EMBEDDING_TIMEOUT_SECONDS = 60.0


def embedder(settings: Settings) -> Embedder:
    client = httpx2.Client(base_url=settings.ollama_url, timeout=EMBEDDING_TIMEOUT_SECONDS)
    return OllamaEmbedder(client, model=settings.embedding_model)


def answer_generator(settings: Settings) -> AnswerGenerator:
    """The OpenAI-compatible API at ``LLM_BASE_URL``, once ``LLM_MODEL`` is set.

    Built once per process, like :func:`embedder`.
    """
    if not settings.llm_model:
        return UnconfiguredGenerator()
    headers = {'Authorization': f'Bearer {settings.llm_api_key}'} if settings.llm_api_key else {}
    client = httpx2.Client(
        base_url=settings.llm_base_url, headers=headers, timeout=settings.llm_timeout_seconds
    )
    return OpenAICompatibleGenerator(client, model=settings.llm_model)


def authenticate(access_token: str, *, tokens: TokenService, session: Session) -> User:
    """The active user an access token belongs to, or raise :class:`InvalidToken`."""
    user = UserRepository(session).find(tokens.user_id_for(access_token))
    if user is None or not user.is_active:
        raise InvalidToken('User not found or inactive.')
    return user
