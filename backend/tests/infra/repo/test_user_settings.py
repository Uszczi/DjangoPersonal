"""UserSettingsRepository: one settings row per user, created on first read."""

from sqlalchemy.orm import Session

from personal.infra.models import User, UserSettings
from personal.infra.repo import UserRepository, UserSettingsRepository
from tests.helpers import count_rows


def test_first_read_creates_the_defaults_once(session: Session, user: User) -> None:
    settings = UserSettingsRepository(session)

    first = settings.get(user=user)
    again = settings.get(user=user)

    assert (first.user_id, first.theme) == (user.id, 'system')
    assert again is first
    assert count_rows(session, UserSettings) == 1


def test_a_first_read_tolerates_a_row_it_has_not_seen(session: Session, user: User) -> None:
    # Another connection inserted the row first: the insert must not fail.
    session.add(UserSettings(user_id=user.id, theme='mocha'))
    session.flush()
    session.expunge_all()

    assert UserSettingsRepository(session).get(user=user).theme == 'mocha'


def test_save_stores_the_change(session: Session, user: User) -> None:
    settings = UserSettingsRepository(session)
    found = settings.get(user=user)
    found.theme = 'sepia'
    settings.save(found)
    session.expire_all()

    assert settings.get(user=user).theme == 'sepia'


def test_settings_are_per_user(session: Session, user: User) -> None:
    other = UserRepository(session).create(username='other', password_hash='hash')
    settings = UserSettingsRepository(session)
    settings.get(user=user).theme = 'dark'
    session.flush()

    assert settings.get(user=other).theme == 'system'


def test_deleting_the_user_deletes_their_settings(session: Session, user: User) -> None:
    UserSettingsRepository(session).get(user=user)

    UserRepository(session).delete(user)

    assert count_rows(session, UserSettings) == 0
