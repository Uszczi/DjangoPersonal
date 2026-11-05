from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from personal.infra.models import IdempotencyKey as IdempotencyKeyModel
from personal.infra.models import User

from ._flush import flush
from .errors import DuplicateIdempotencyKey


class IdempotencyKeyRepository:
    """The stored answers to write requests, by the client's ``Idempotency-Key``.

    Used by the API's idempotency middleware, each step in a unit of work of
    its own: claiming a key must be committed before the request runs, so a
    second copy of the request arriving meanwhile sees the claim.
    """

    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, record_id: UUID) -> IdempotencyKeyModel | None:
        """A record by its id, as :meth:`claim` returned it."""
        return self.session.get(IdempotencyKeyModel, record_id)

    def find(self, key: str, *, user: User) -> IdempotencyKeyModel | None:
        query = select(IdempotencyKeyModel).where(
            IdempotencyKeyModel.user_id == user.id, IdempotencyKeyModel.key == key
        )
        return self.session.scalars(query).first()

    def claim(
        self, key: str, *, user: User, method: str, path: str, at: datetime
    ) -> IdempotencyKeyModel:
        """Record ``key`` as a request now running; :class:`DuplicateIdempotencyKey` if taken."""
        record = IdempotencyKeyModel(
            user_id=user.id, key=key, method=method, path=path, created_at=at
        )
        self.session.add(record)
        flush(self.session, on_conflict=DuplicateIdempotencyKey)
        return record

    def complete(
        self, record: IdempotencyKeyModel, *, status_code: int, content_type: str, body: bytes
    ) -> None:
        record.status_code = status_code
        record.content_type = content_type
        record.body = body
        self.session.flush()

    def delete(self, record: IdempotencyKeyModel) -> None:
        self.session.delete(record)
        self.session.flush()

    def delete_older_than(self, moment: datetime, *, user: User) -> None:
        self.session.execute(
            delete(IdempotencyKeyModel).where(
                IdempotencyKeyModel.user_id == user.id, IdempotencyKeyModel.created_at < moment
            )
        )
