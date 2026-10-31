"""MobileSettingsRepository: one settings row per user, created on first read."""

from sqlalchemy.orm import Session

from personal.infra.models import MobileSettings, User
from personal.infra.repo import MobileSettingsRepository, UserRepository
from tests.helpers import count_rows


def test_first_read_creates_the_defaults_once(session: Session, user: User) -> None:
    settings = MobileSettingsRepository(session)

    first = settings.get(user=user)
    again = settings.get(user=user)

    assert (first.user_id, first.hidden_tabs) == (user.id, [])
    assert again is first
    assert count_rows(session, MobileSettings) == 1


def test_a_first_read_tolerates_a_row_it_has_not_seen(session: Session, user: User) -> None:
    # Another connection inserted the row first: the insert must not fail.
    session.add(MobileSettings(user_id=user.id, hidden_tabs=['bibliography']))
    session.flush()
    session.expunge_all()

    assert MobileSettingsRepository(session).get(user=user).hidden_tabs == ['bibliography']


def test_save_stores_the_change(session: Session, user: User) -> None:
    settings = MobileSettingsRepository(session)
    found = settings.get(user=user)
    found.hidden_tabs = ['time', 'counters']
    settings.save(found)
    session.expire_all()

    assert settings.get(user=user).hidden_tabs == ['time', 'counters']


def test_settings_are_per_user(session: Session, user: User) -> None:
    other = UserRepository(session).create(username='other', password_hash='hash')
    settings = MobileSettingsRepository(session)
    settings.get(user=user).hidden_tabs = ['bibliography']
    session.flush()

    assert settings.get(user=other).hidden_tabs == []


def test_deleting_the_user_deletes_their_settings(session: Session, user: User) -> None:
    MobileSettingsRepository(session).get(user=user)

    UserRepository(session).delete(user)

    assert count_rows(session, MobileSettings) == 0
