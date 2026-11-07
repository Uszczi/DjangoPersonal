"""Tags: unique names per user, and the Tags a Task payload may name."""

from uuid import UUID

import pytest
from sqlalchemy.orm import Session

from personal.core.shared.errors import DomainError
from personal.core.work.contracts import (
    PatchedTagRequest,
    PatchedTaskUpdateRequest,
    TagRequest,
    TaskCreateRequest,
)
from personal.core.work.handlers import CreateTag, CreateTask, DeleteTag, UpdateTag, UpdateTask
from personal.infra.models import Tag, Task, User
from personal.infra.repo import ProjectRepository, TagRepository, TaskRepository, UserRepository


@pytest.fixture
def user(session: Session) -> User:
    return UserRepository(session).create(username='tag-user', password_hash='hash')


@pytest.fixture
def other(session: Session) -> User:
    return UserRepository(session).create(username='someone-else', password_hash='hash')


def _tag(session: Session, user: User, name: str) -> Tag:
    return CreateTag(TagRepository(session), user).execute(TagRequest(name=name))


def _create_task(session: Session, user: User, tags: list[UUID]) -> Task:
    handler = CreateTask(
        ProjectRepository(session), TaskRepository(session), TagRepository(session), user
    )
    return handler.execute(TaskCreateRequest(title='Plan', tags=tags))


def _update_task(session: Session, user: User, task: Task, **fields: object) -> Task:
    handler = UpdateTask(
        ProjectRepository(session), TaskRepository(session), TagRepository(session), user
    )
    return handler.execute(task.id, PatchedTaskUpdateRequest.model_validate(fields))


def test_a_tag_name_is_unique_per_user_ignoring_case(
    session: Session, user: User, other: User
) -> None:
    _tag(session, user, 'Pilne')

    with pytest.raises(DomainError, match='already exists'):
        _tag(session, user, 'pilne')
    assert _tag(session, other, 'pilne').name == 'pilne'


def test_renaming_a_tag_to_its_own_name_in_another_case_is_allowed(
    session: Session, user: User
) -> None:
    tag = _tag(session, user, 'pilne')

    renamed = UpdateTag(TagRepository(session), user).execute(
        tag.id, PatchedTagRequest(name='Pilne')
    )

    assert renamed.name == 'Pilne'


def test_a_task_carries_the_tags_it_is_given_alphabetically(
    session: Session, user: User
) -> None:
    work = _tag(session, user, 'Praca')
    urgent = _tag(session, user, 'Pilne')

    task = _create_task(session, user, [work.id, urgent.id, work.id])

    assert [tag.name for tag in task.tags] == ['Pilne', 'Praca']


def test_a_task_cannot_carry_another_users_tag(
    session: Session, user: User, other: User
) -> None:
    theirs = _tag(session, other, 'Cudze')

    with pytest.raises(DomainError, match='Invalid tag ID'):
        _create_task(session, user, [theirs.id])


def test_updating_tags_replaces_them_and_other_fields_keep_them(
    session: Session, user: User
) -> None:
    work = _tag(session, user, 'Praca')
    urgent = _tag(session, user, 'Pilne')
    task = _create_task(session, user, [work.id])

    _update_task(session, user, task, title='Renamed')
    assert [tag.name for tag in task.tags] == ['Praca']

    _update_task(session, user, task, tags=[urgent.id])
    assert [tag.name for tag in task.tags] == ['Pilne']

    _update_task(session, user, task, tags=[])
    assert task.tags == []


def test_deleting_a_tag_takes_it_off_its_tasks(session: Session, user: User) -> None:
    work = _tag(session, user, 'Praca')
    task = _create_task(session, user, [work.id])

    DeleteTag(TagRepository(session), user).execute(work.id)
    session.expire_all()

    found = TaskRepository(session).find(task.id, user=user)
    assert found is not None
    assert found.tags == []
