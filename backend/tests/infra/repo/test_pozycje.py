"""PozycjaRepository: per-user lookups, order, and the invariants every writer gets."""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from personal.infra.models import Pozycja, User
from personal.infra.repo import PozycjaRepository, UserRepository


def test_save_trims_title_and_creator(session: Session, user: User) -> None:
    pozycja = PozycjaRepository(session).save(
        Pozycja(user=user, kind='film', title='  Rejs ', creator=' Marek Piwowski ')
    )

    assert pozycja.title == 'Rejs'
    assert pozycja.creator == 'Marek Piwowski'
    assert pozycja.status == 'planned'


def test_list_and_find_see_only_the_users_pozycje(session: Session, user: User) -> None:
    repository = PozycjaRepository(session)
    other = UserRepository(session).create(username='other', password_hash='hash')
    lalka = repository.save(Pozycja(user=user, kind='book', title='Lalka'))
    rejs = repository.save(Pozycja(user=user, kind='film', title='Rejs'))
    theirs = repository.save(Pozycja(user=other, kind='film', title='Miś'))

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
        PozycjaRepository(session).save(Pozycja(user=user, **values))
