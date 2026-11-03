"""Shared base views for the admin panel."""

from typing import Any, Protocol

import anyio.to_thread
from sqladmin import ModelView
from sqlalchemy.orm import Session
from starlette.requests import Request


class _Deletes(Protocol):
    def delete(self, obj: Any, /) -> None: ...


class _AppView(ModelView):
    can_create = False
    page_size = 50


class _RepositoryDeleteView(_AppView):
    """Deletes through the entity's repository instead of a bare ``session.delete``."""

    def repository(self, session: Session) -> _Deletes:
        raise NotImplementedError

    async def delete_model(self, request: Request, pk: Any) -> None:
        await anyio.to_thread.run_sync(self._delete, pk)

    def _delete(self, pk: Any) -> None:
        with self.session_maker() as session, session.begin():
            obj = session.get(self.model, int(pk))
            if obj is not None:
                self.repository(session).delete(obj)
