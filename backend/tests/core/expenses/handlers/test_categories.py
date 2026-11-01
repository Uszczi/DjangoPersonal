"""Category kinds: chosen at creation, never changed."""

from collections.abc import Callable

import pytest
from sqlalchemy.orm import Session

from personal import wiring
from personal.core.expenses.contracts import CategoryRequest, PatchedCategoryRequest
from personal.core.expenses.handlers import (
    CreateCategory,
    ReplaceCategory,
    UpdateCategory,
)
from personal.core.shared.errors import DomainError
from personal.infra.models import User


def test_a_category_is_an_expense_one_unless_told_otherwise(
    session: Session, make_user: Callable[..., User]
) -> None:
    user = make_user('maker')
    create = CreateCategory(wiring.category_repository(session), user)

    food = create.execute(CategoryRequest(name='Food'))
    bonus = create.execute(CategoryRequest(name='Bonus', kind='income'))

    assert (food.kind, bonus.kind) == ('expense', 'income')


@pytest.mark.parametrize(
    'change',
    [
        lambda repository, user, id_: ReplaceCategory(repository, user).execute(
            id_, CategoryRequest(name='Bonus', kind='expense')
        ),
        lambda repository, user, id_: UpdateCategory(repository, user).execute(
            id_, PatchedCategoryRequest(kind='expense')
        ),
    ],
    ids=['replace', 'update'],
)
def test_the_kind_cannot_be_changed(
    session: Session, make_user: Callable[..., User], change: Callable[..., object]
) -> None:
    user = make_user('changer')
    repository = wiring.category_repository(session)
    bonus = CreateCategory(repository, user).execute(CategoryRequest(name='Bonus', kind='income'))

    with pytest.raises(DomainError, match='The kind of a category cannot be changed.'):
        change(repository, user, bonus.id)


def test_the_same_kind_passes_and_put_without_kind_keeps_an_expense_one(
    session: Session, make_user: Callable[..., User]
) -> None:
    user = make_user('keeper')
    repository = wiring.category_repository(session)
    bonus = CreateCategory(repository, user).execute(CategoryRequest(name='Bonus', kind='income'))
    food = CreateCategory(repository, user).execute(CategoryRequest(name='Food'))

    UpdateCategory(repository, user).execute(
        bonus.id, PatchedCategoryRequest(name='Premia', kind='income')
    )
    ReplaceCategory(repository, user).execute(food.id, CategoryRequest(name='Groceries'))

    assert (bonus.name, bonus.kind) == ('Premia', 'income')
    assert (food.name, food.kind) == ('Groceries', 'expense')
