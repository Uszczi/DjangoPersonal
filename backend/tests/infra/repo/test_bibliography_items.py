"""BibliographyItemRepository: per-user lookups, order, and the invariants every writer gets."""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from personal.infra.models import BibliographyItem, User
from personal.infra.repo import BibliographyItemRepository, UserRepository


def test_save_trims_title_and_creator(session: Session, user: User) -> None:
    item = BibliographyItemRepository(session).save(
        BibliographyItem(user=user, kind='film', title='  Rejs ', creator=' Marek Piwowski ')
    )

    assert item.title == 'Rejs'
    assert item.creator == 'Marek Piwowski'
    assert item.status == 'planned'


def test_list_and_find_see_only_the_users_items(session: Session, user: User) -> None:
    repository = BibliographyItemRepository(session)
    other = UserRepository(session).create(username='other', password_hash='hash')
    lalka = repository.save(BibliographyItem(user=user, kind='book', title='Lalka'))
    rejs = repository.save(BibliographyItem(user=user, kind='film', title='Rejs'))
    theirs = repository.save(BibliographyItem(user=other, kind='film', title='Miś'))

    assert repository.list_all(user=user) == [rejs, lalka]
    assert repository.find(lalka.id, user=user) is lalka
    assert repository.find(theirs.id, user=user) is None


@pytest.mark.parametrize(
    'fields', [{'kind': 'serial'}, {'year': 0}, {'length': -1}]
)
def test_database_rejects_invalid_values(
    session: Session, user: User, fields: dict[str, object]
) -> None:
    values: dict[str, object] = {'kind': 'book', 'title': 'Lalka', **fields}

    with pytest.raises(IntegrityError):
        BibliographyItemRepository(session).save(BibliographyItem(user=user, **values))
