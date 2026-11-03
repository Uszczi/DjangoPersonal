"""SuggestTimeEntryTitles: which past titles match what the user types, and in what order."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from personal.core.work.handlers import SuggestTimeEntryTitles
from personal.infra.models import User
from personal.infra.repo import TimeEntryRepository, UserRepository

BEGAN = datetime(2026, 10, 20, 9, 0, tzinfo=UTC)


@pytest.fixture
def user(session: Session) -> User:
    return UserRepository(session).create(username='timer-user', password_hash='hash')


def _log(session: Session, user: User, *titles: str) -> None:
    """Log one entry per title, each an hour after the previous one."""
    entries = TimeEntryRepository(session)
    for offset, title in enumerate(titles):
        start = BEGAN + timedelta(hours=offset)
        entries.create(user=user, title=title, start=start, end=start + timedelta(minutes=5))


def _suggest(session: Session, user: User, search: str = '', limit: int = 10) -> list[str]:
    found = SuggestTimeEntryTitles(TimeEntryRepository(session), user).execute(search, limit)
    return [title for title, _ in found]


def test_empty_search_returns_the_most_recently_used_titles(
    session: Session, user: User
) -> None:
    _log(session, user, 'Raport', 'Mejle', 'Raport', 'Code review')

    assert _suggest(session, user) == ['Code review', 'Raport', 'Mejle']
    assert _suggest(session, user, limit=2) == ['Code review', 'Raport']


def test_search_ignores_case_and_puts_prefix_matches_first(
    session: Session, user: User
) -> None:
    _log(session, user, 'Łódź: spotkanie', 'Przegląd kodu', 'Kod źródłowy', 'Mejle')

    assert _suggest(session, user, 'KOD') == ['Kod źródłowy', 'Przegląd kodu']
    assert _suggest(session, user, '  łÓ ') == ['Łódź: spotkanie']
    assert _suggest(session, user, 'nic') == []
