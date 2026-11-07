from uuid import UUID

from fastapi import APIRouter, Response, status

from personal.core.work import handlers
from personal.core.work.contracts import PatchedTagRequest, TagRequest, TagResponse
from personal.entrypoints.http.deps import CurrentUser, TagRepositoryDep

router = APIRouter(tags=['personal'])


@router.get('/tags/', operation_id='tags_list')
def list_tags(user: CurrentUser, tags: TagRepositoryDep) -> list[TagResponse]:
    return [TagResponse.model_validate(tag) for tag in handlers.ListTags(tags, user).execute()]


@router.post('/tags/', status_code=status.HTTP_201_CREATED, operation_id='tags_create')
def create_tag(payload: TagRequest, user: CurrentUser, tags: TagRepositoryDep) -> TagResponse:
    return TagResponse.model_validate(handlers.CreateTag(tags, user).execute(payload))


@router.get('/tags/{id}/', operation_id='tags_retrieve')
def get_tag(id: UUID, user: CurrentUser, tags: TagRepositoryDep) -> TagResponse:
    return TagResponse.model_validate(handlers.GetTag(tags, user).execute(id))


@router.patch('/tags/{id}/', operation_id='tags_partial_update')
def update_tag(
    id: UUID, payload: PatchedTagRequest, user: CurrentUser, tags: TagRepositoryDep
) -> TagResponse:
    return TagResponse.model_validate(handlers.UpdateTag(tags, user).execute(id, payload))


@router.delete(
    '/tags/{id}/',
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id='tags_destroy',
)
def delete_tag(id: UUID, user: CurrentUser, tags: TagRepositoryDep) -> None:
    handlers.DeleteTag(tags, user).execute(id)
