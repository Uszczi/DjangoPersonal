"""Admin views of the Bibliography: BibliographyItems with their derived status, and Attempts."""

import re
from collections.abc import Callable
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from personal.infra import factories
from personal.infra.models import Attempt, BibliographyItem, User
from tests.entrypoints.admin.helpers import sign_in


@pytest.fixture
def owner(panel: TestClient, make_user: Callable[..., User]) -> User:
    make_user('boss', is_staff=True)
    owner = make_user('owner')
    sign_in(panel, 'boss')
    return owner


def _row(html: str, text: str) -> str:
    """The list table row that contains ``text``."""
    rows = [row for row in re.split(r'<tr\b', html) if text in row]
    assert len(rows) == 1, f'expected one row with {text!r}, found {len(rows)}'
    return rows[0]


def test_items_are_listed_with_owner_kind_title_and_derived_status(
    panel: TestClient, owner: User
) -> None:
    factories.BibliographyItemFactory.create(user=owner, kind='film', title='Solaris')
    reading = factories.BibliographyItemFactory.create(user=owner, title='Dune')
    factories.AttemptFactory.create(item=reading, outcome='finished', ended_on=date(2026, 1, 5))
    factories.AttemptFactory.create(item=reading, outcome='in_progress', ended_on=None)
    dropped = factories.BibliographyItemFactory.create(user=owner, title='Ulysses')
    factories.AttemptFactory.create(item=dropped, outcome='abandoned')

    response = panel.get('/admin/bibliography-item/list')

    assert response.status_code == 200
    solaris = _row(response.text, 'Solaris')
    assert 'owner' in solaris and 'film' in solaris and 'planned' in solaris
    dune = _row(response.text, 'Dune')
    assert 'book' in dune and 'in_progress' in dune
    assert 'abandoned' in _row(response.text, 'Ulysses')


def test_item_details_show_the_derived_status(panel: TestClient, owner: User) -> None:
    item = factories.BibliographyItemFactory.create(user=owner, title='Dune')
    factories.AttemptFactory.create(item=item, outcome='finished')

    response = panel.get(f'/admin/bibliography-item/details/{item.id}')

    assert response.status_code == 200
    assert 'finished' in response.text


def test_attempts_are_listed_with_their_item_outcome_and_dates(
    panel: TestClient, owner: User
) -> None:
    item = factories.BibliographyItemFactory.create(user=owner, title='Dune')
    attempt = factories.AttemptFactory.create(
        item=item,
        outcome='abandoned',
        started_on=date(2026, 3, 1),
        ended_on=date(2026, 3, 9),
    )

    response = panel.get('/admin/attempt/list')

    assert response.status_code == 200
    row = _row(response.text, 'abandoned')
    assert 'Dune' in row and '2026-03-01' in row and '2026-03-09' in row
    assert panel.get(f'/admin/attempt/details/{attempt.id}').status_code == 200


def test_nothing_is_created_from_the_panel(panel: TestClient, owner: User) -> None:
    assert panel.get('/admin/bibliography-item/create').status_code == 403
    assert panel.get('/admin/attempt/create').status_code == 403


def test_attempts_are_not_edited_or_deleted_from_the_panel(
    panel: TestClient, owner: User, session: Session
) -> None:
    attempt = factories.AttemptFactory.create(item__user=owner, user=owner)

    assert panel.get(f'/admin/attempt/edit/{attempt.id}').status_code == 403
    panel.delete(f'/admin/attempt/delete?pks={attempt.id}')

    session.expire_all()
    assert session.get(Attempt, attempt.id) is not None


def test_an_item_edit_changes_plain_fields_but_never_the_kind(
    panel: TestClient, owner: User, session: Session
) -> None:
    item = factories.BibliographyItemFactory.create(user=owner, kind='book', title='Dune')

    form = panel.get(f'/admin/bibliography-item/edit/{item.id}')
    assert form.status_code == 200
    assert 'name="kind"' not in form.text
    panel.post(
        f'/admin/bibliography-item/edit/{item.id}',
        data={'title': '  Dune Messiah ', 'creator': 'Frank Herbert', 'note': 'Reread', 'kind': 'film'},
    )

    session.expire_all()
    edited = session.get(BibliographyItem, item.id)
    assert edited is not None
    assert (edited.title, edited.creator, edited.note, edited.kind) == (
        'Dune Messiah', 'Frank Herbert', 'Reread', 'book'
    )


def test_items_are_not_deleted_from_the_panel(
    panel: TestClient, owner: User, session: Session
) -> None:
    item = factories.BibliographyItemFactory.create(user=owner)

    panel.delete(f'/admin/bibliography-item/delete?pks={item.id}')

    session.expire_all()
    assert session.get(BibliographyItem, item.id) is not None
