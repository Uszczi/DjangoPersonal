"""Tags: the user's labels for Tasks, shared by every Project."""

from collections.abc import Sequence
from functools import partial
from uuid import UUID

from personal.core.shared.errors import DomainError, NotFound
from personal.core.shared.patch import apply_provided
from personal.core.work.contracts import PatchedTagRequest, TagRequest
from personal.infra.models import Tag as TagModel
from personal.infra.models import User
from personal.infra.repo import DuplicateTagName, TagRepository
from personal.infra.rules import normalize_tag_name, tag_name_key

DUPLICATE_NAME = 'A tag with this name already exists.'


def _get_tag(repository: TagRepository, tag_id: UUID, *, user: User) -> TagModel:
    tag = repository.find(tag_id, user=user)
    if tag is None:
        raise NotFound('Tag not found.')
    return tag


def _validate_name(
    repository: TagRepository, name: str, current: TagModel | None = None, *, user: User
) -> str:
    name = normalize_tag_name(name)
    if repository.name_taken(tag_name_key(name), user=user, exclude=current):
        raise DomainError(DUPLICATE_NAME)
    return name


def _save(repository: TagRepository, tag: TagModel) -> TagModel:
    """Persist a Tag, presenting a name clash (a concurrent create) as a domain error."""
    try:
        return repository.save(tag)
    except DuplicateTagName as error:
        raise DomainError(DUPLICATE_NAME) from error


def resolve_tags(repository: TagRepository, tag_ids: Sequence[UUID], *, user: User) -> list[TagModel]:
    """The user's Tags for the ids a Task payload names; an unknown id is refused.

    A repeated id counts once.
    """
    wanted = set(tag_ids)
    found = repository.find_many(wanted, user=user)
    if len(found) != len(wanted):
        raise DomainError('Invalid tag ID.')
    return found


class ListTags:
    def __init__(self, tags: TagRepository, user: User):
        self.tags = tags
        self.user = user

    def execute(self) -> list[TagModel]:
        return self.tags.list_all(user=self.user)


class GetTag:
    def __init__(self, tags: TagRepository, user: User):
        self.tags = tags
        self.user = user

    def execute(self, tag_id: UUID) -> TagModel:
        return _get_tag(self.tags, tag_id, user=self.user)


class CreateTag:
    def __init__(self, tags: TagRepository, user: User):
        self.tags = tags
        self.user = user

    def execute(self, data: TagRequest) -> TagModel:
        tag = TagModel(
            user=self.user,
            name=_validate_name(self.tags, data.name, user=self.user),
            color=data.color,
        )
        return _save(self.tags, tag)


class UpdateTag:
    def __init__(self, tags: TagRepository, user: User):
        self.tags = tags
        self.user = user

    def execute(self, tag_id: UUID, data: PatchedTagRequest) -> TagModel:
        tag = _get_tag(self.tags, tag_id, user=self.user)
        apply_provided(
            data,
            tag,
            resolve={'name': partial(_validate_name, self.tags, current=tag, user=self.user)},
        )
        return _save(self.tags, tag)


class DeleteTag:
    """Delete a Tag, taking it off every Task that carries it."""

    def __init__(self, tags: TagRepository, user: User):
        self.tags = tags
        self.user = user

    def execute(self, tag_id: UUID) -> None:
        self.tags.delete(_get_tag(self.tags, tag_id, user=self.user))
