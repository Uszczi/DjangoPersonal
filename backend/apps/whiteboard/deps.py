"""Composition root for the ``whiteboard`` app (see ``apps.work.deps``)."""

from sqlalchemy.orm import Session

from apps.infra.repo import WhiteboardRepository


def whiteboard_repository(session: Session) -> WhiteboardRepository:
    return WhiteboardRepository(session)
