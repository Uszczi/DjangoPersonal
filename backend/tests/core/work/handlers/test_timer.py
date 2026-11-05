"""StartTimer and StopTimer with a client's ``at``: a timer action sent late records the moment it meant."""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid7

import pytest
from sqlalchemy.orm import Session

from personal.core.shared.errors import DomainError
from personal.core.work import clock
from personal.core.work.contracts import TimerStartRequest, TimerStopRequest
from personal.core.work.handlers import GetRunningEntry, StartTimer, StopTimer
from personal.infra.models import User
from personal.infra.repo import TaskRepository, TimeEntryRepository, UserRepository

NOW = datetime(2026, 11, 5, 12, 0, tzinfo=UTC)


@pytest.fixture(autouse=True)
def frozen_clock(monkeypatch: Any) -> None:
    monkeypatch.setattr(clock, 'now', lambda: NOW)


@pytest.fixture
def user(session: Session) -> User:
    return UserRepository(session).create(username='timer-user', password_hash='hash')


def _start(session: Session, user: User, **fields: Any) -> Any:
    handler = StartTimer(TaskRepository(session), TimeEntryRepository(session), user)
    return handler.execute(TimerStartRequest(title='Raport', **fields))


def _stop(session: Session, user: User, **fields: Any) -> Any:
    return StopTimer(TimeEntryRepository(session), user).execute(TimerStopRequest(**fields))


def _running(session: Session, user: User) -> Any:
    return GetRunningEntry(TimeEntryRepository(session), user).execute()


def test_a_late_start_begins_when_the_user_pressed_it(session: Session, user: User) -> None:
    pressed = NOW - timedelta(minutes=40)

    entry = _start(session, user, at=pressed)

    assert entry.start == pressed
    assert entry.end is None


def test_a_start_keeps_the_id_the_client_chose(session: Session, user: User) -> None:
    chosen = uuid7()

    entry = _start(session, user, id=chosen)

    assert entry.id == chosen


def test_the_same_start_sent_again_returns_the_entry_it_made(
    session: Session, user: User
) -> None:
    chosen = uuid7()
    first = _start(session, user, id=chosen, at=NOW - timedelta(minutes=5))

    again = _start(session, user, id=chosen, at=NOW - timedelta(minutes=5))

    assert again is first
    assert len(TimeEntryRepository(session).list(user=user)) == 1


def test_a_start_slightly_ahead_of_the_server_clock_counts_as_now(
    session: Session, user: User
) -> None:
    entry = _start(session, user, at=NOW + timedelta(seconds=30))

    assert entry.start == NOW


@pytest.mark.parametrize(
    'at', [NOW + timedelta(minutes=5), NOW - timedelta(days=7, minutes=1)], ids=['future', 'stale']
)
def test_a_start_too_far_from_now_is_refused(session: Session, user: User, at: datetime) -> None:
    with pytest.raises(DomainError):
        _start(session, user, at=at)


def test_a_late_start_ends_the_running_timer_at_its_own_moment(
    session: Session, user: User
) -> None:
    previous = _start(session, user, at=NOW - timedelta(hours=1))

    _start(session, user, at=NOW - timedelta(minutes=10))

    assert previous.end == NOW - timedelta(minutes=10)


def test_a_late_start_older_than_the_running_timer_is_refused(
    session: Session, user: User
) -> None:
    # Another device started a timer after the moment this Start was pressed.
    _start(session, user, at=NOW - timedelta(minutes=10))

    with pytest.raises(DomainError, match='started later'):
        _start(session, user, at=NOW - timedelta(minutes=30))


def test_a_late_limited_start_whose_limit_has_passed_is_recorded_stopped(
    session: Session, user: User
) -> None:
    entry = _start(session, user, at=NOW - timedelta(hours=1), duration_minutes=25)

    assert entry.end == NOW - timedelta(minutes=35)
    assert _running(session, user) is None


def test_a_late_stop_ends_the_timer_when_the_user_pressed_it(
    session: Session, user: User
) -> None:
    started = _start(session, user, at=NOW - timedelta(hours=1))

    stopped = _stop(session, user, entry=started.id, at=NOW - timedelta(minutes=20))

    assert stopped.end == NOW - timedelta(minutes=20)
    assert _running(session, user) is None


def test_a_stop_cannot_end_a_timer_before_it_started(session: Session, user: User) -> None:
    _start(session, user, at=NOW - timedelta(minutes=10))

    with pytest.raises(DomainError):
        _stop(session, user, at=NOW - timedelta(minutes=30))


def test_stopping_an_entry_that_already_ended_leaves_the_new_timer_running(
    session: Session, user: User
) -> None:
    first = _start(session, user, at=NOW - timedelta(hours=1))
    second = _start(session, user, at=NOW - timedelta(minutes=10))

    stopped = _stop(session, user, entry=first.id, at=NOW - timedelta(minutes=5))

    assert stopped.id == first.id
    assert stopped.end == NOW - timedelta(minutes=10)
    assert _running(session, user) is second


def test_stopping_an_entry_that_does_not_exist_is_refused(
    session: Session, user: User
) -> None:
    _start(session, user)

    with pytest.raises(DomainError, match='no longer exists'):
        _stop(session, user, entry=uuid7())
    assert _running(session, user) is not None
