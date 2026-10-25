"""Probe endpoints standing in for the domain routers."""

from fastapi import APIRouter
from sqlalchemy import text

from personal.core.shared.errors import DomainError, NotFound
from personal.core.work.contracts import PatchedProjectRequest, ProjectRequest
from personal.entrypoints.http.deps import SessionDep

PROBE_PREFIX = '/api/v1/_probe'


def probe_router() -> APIRouter:
    """Endpoints that exercise the shared infrastructure the way features will."""
    router = APIRouter(prefix=PROBE_PREFIX)

    @router.post('/projects/', status_code=201)
    def create(payload: ProjectRequest) -> dict[str, str]:
        return {'name': payload.name}

    @router.patch('/projects/{id}/')
    def update(id: int, payload: PatchedProjectRequest) -> dict[str, int]:
        return {'id': id}

    @router.get('/missing/')
    def missing() -> None:
        raise NotFound('Project not found.')

    @router.get('/unauthorized/')
    def unauthorized() -> None:
        raise DomainError('Invalid username or password.', status=401)

    @router.post('/notes/')
    def add_note(session: SessionDep, fail: bool = False) -> dict[str, bool]:
        session.execute(text("INSERT INTO note (body) VALUES ('kept?')"))
        if fail:
            raise DomainError('Rejected after the write.')
        return {'ok': True}

    @router.post('/orphans/')
    def add_orphan(session: SessionDep) -> dict[str, bool]:
        # The FK is deferred, so the violation only surfaces at commit.
        session.execute(text('INSERT INTO child (parent_id) VALUES (999)'))
        return {'ok': True}

    return router
