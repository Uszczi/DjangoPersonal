"""Composition root for the ``whiteboard`` app (see ``apps.work.deps``)."""

from typing import Annotated

from fastapi import Depends

from apps.infra.repo import WhiteboardRepository
from config.db import SessionDep


def whiteboard_repository(session: SessionDep) -> WhiteboardRepository:
    return WhiteboardRepository(session)


WhiteboardRepositoryDep = Annotated[WhiteboardRepository, Depends(whiteboard_repository)]
