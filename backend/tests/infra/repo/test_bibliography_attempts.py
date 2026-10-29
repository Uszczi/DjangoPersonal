"""AttemptRepository: per-user lookups and the database's safety net."""

from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from personal.infra.models import Attempt, BibliographyItem, User
from personal.infra.repo import (
    AttemptAlreadyInProgress,
    AttemptRepository,
    BibliographyItemRepository,
    UserRepository,
)


def _item(session: Session, user: User, title: str = 'Lalka') -> BibliographyItem:
    item = BibliographyItem(user=user, kind='book', title=title)
    return BibliographyItemRepository(session).save(item)


def test_lookups_see_only_the_users_attempts(session: Session, user: User) -> None:
    repository = AttemptRepository(session)
    other = UserRepository(session).create(username='other', password_hash='hash')
    lalka = _item(session, user)
    rejs = _item(session, user, 'Rejs')
    theirs = _item(session, other, 'Miś')
    first = repository.save(Attempt(user=user, item=lalka, outcome='in_progress'))
    on_rejs = repository.save(Attempt(user=user, item=rejs, outcome='in_progress'))
    hidden = repository.save(Attempt(user=other, item=theirs, outcome='in_progress'))

    assert repository.list_for_item(lalka.id, user=user) == [first]
    assert repository.by_item([lalka, rejs, theirs], user=user) == {
        lalka.id: [first],
        rejs.id: [on_rejs],
        theirs.id: [],
    }
    assert repository.find(first.id, user=user) is first
    assert repository.find(hidden.id, user=user) is None


def test_a_second_attempt_in_progress_is_refused(session: Session, user: User) -> None:
    repository = AttemptRepository(session)
    item = _item(session, user)
    repository.save(Attempt(user=user, item=item, outcome='in_progress'))

    with pytest.raises(AttemptAlreadyInProgress):
        repository.save(Attempt(user=user, item=item, outcome='in_progress'))


@pytest.mark.parametrize(
    ('outcome', 'started_on', 'ended_on'),
    [
        ('finished', None, None),
        ('in_progress', None, date(2026, 1, 1)),
        ('abandoned', date(2026, 1, 2), date(2026, 1, 1)),
        ('paused', None, None),
    ],
)
def test_the_database_rejects_inconsistent_dates_and_outcomes(
    session: Session,
    user: User,
    outcome: str,
    started_on: date | None,
    ended_on: date | None,
) -> None:
    item = _item(session, user)
    session.add(
        Attempt(
            user=user, item=item, outcome=outcome, started_on=started_on, ended_on=ended_on
        )
    )

    with pytest.raises(IntegrityError):
        session.flush()
