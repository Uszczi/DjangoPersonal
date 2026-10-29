from datetime import date

from personal.core.shared.errors import DomainError, NotFound
from personal.core.shared.patch import apply_provided
from personal.infra.models import Attempt as AttemptModel
from personal.infra.models import User
from personal.infra.repo import (
    AttemptAlreadyInProgress,
    AttemptRepository,
    BibliographyItemRepository,
)

from ..contracts import AttemptRequest, PatchedAttemptRequest
from ..progress import check_progress_within_length
from ..status import is_in_progress
from .items import get_bibliography_item

ALREADY_IN_PROGRESS = 'This bibliography item already has an Attempt in progress.'
PROGRESS_ONLY_IN_PROGRESS = 'Progress is set only on an Attempt in progress.'
NO_REOPENING = 'An ended Attempt cannot be put back in progress; start a new Attempt instead.'


def _get_attempt(repository: AttemptRepository, attempt_id: int, *, user: User) -> AttemptModel:
    attempt = repository.find(attempt_id, user=user)
    if attempt is None:
        raise NotFound('Attempt not found.')
    return attempt


def _check_dates(attempt: AttemptModel) -> None:
    """An end date exactly once it has ended, and never before the start."""
    in_progress = is_in_progress(attempt)
    if in_progress and attempt.ended_on is not None:
        raise DomainError('An Attempt in progress has no end date.')
    if not in_progress and attempt.ended_on is None:
        raise DomainError('A finished or abandoned Attempt needs an end date.')
    if (
        attempt.started_on is not None
        and attempt.ended_on is not None
        and attempt.ended_on < attempt.started_on
    ):
        raise DomainError('The end date cannot be before the start date.')


def _settle_progress(attempt: AttemptModel, *, progress_given: bool) -> None:
    """Progress means something only while the Attempt is in progress.

    Asking for it on an ended Attempt is an error; ending an Attempt simply drops
    the progress it had. Reaching the length does not end it.
    """
    if is_in_progress(attempt):
        check_progress_within_length(attempt.progress, attempt.item.length)
        return
    if attempt.progress is None:
        return
    if progress_given:
        raise DomainError(PROGRESS_ONLY_IN_PROGRESS)
    attempt.progress = None


def _check_one_in_progress(attempt: AttemptModel, others: list[AttemptModel]) -> None:
    """A BibliographyItem has at most one Attempt in progress; nothing is closed silently.

    ``others`` is loaded before ``attempt`` is changed, so the query's autoflush
    cannot run into the database's own guard first.
    """
    if not is_in_progress(attempt):
        return
    for other in others:
        if other is not attempt and is_in_progress(other):
            raise DomainError(ALREADY_IN_PROGRESS)


def _check_not_reopened(attempt: AttemptModel, *, was_ended: bool) -> None:
    """Resuming a finished or abandoned item means starting a new Attempt.

    An ended Attempt may still switch between finished and abandoned or be re-dated,
    but going back in progress would rewrite history the item's status relies on.
    """
    if was_ended and is_in_progress(attempt):
        raise DomainError(NO_REOPENING)


def _save(repository: AttemptRepository, attempt: AttemptModel) -> AttemptModel:
    try:
        return repository.save(attempt)
    except AttemptAlreadyInProgress as error:
        raise DomainError(ALREADY_IN_PROGRESS) from error


def history_order(attempts: list[AttemptModel]) -> list[AttemptModel]:
    """Latest first: the one in progress, then by end date, newest first."""

    def key(attempt: AttemptModel) -> tuple[bool, date, int]:
        return (is_in_progress(attempt), attempt.ended_on or date.min, attempt.id)

    return sorted(attempts, key=key, reverse=True)


class ListAttempts:
    """The history of one BibliographyItem's Attempts, latest first."""

    def __init__(
        self, attempts: AttemptRepository, items: BibliographyItemRepository, user: User
    ):
        self.attempts = attempts
        self.items = items
        self.user = user

    def execute(self, item_id: int) -> list[AttemptModel]:
        item = get_bibliography_item(self.items, item_id, user=self.user)
        return history_order(self.attempts.list_for_item(item.id, user=self.user))


class GetAttempt:
    def __init__(self, attempts: AttemptRepository, user: User):
        self.attempts = attempts
        self.user = user

    def execute(self, attempt_id: int) -> AttemptModel:
        return _get_attempt(self.attempts, attempt_id, user=self.user)


class CreateAttempt:
    """Start an Attempt, or record one that has already ended in one step."""

    def __init__(
        self, attempts: AttemptRepository, items: BibliographyItemRepository, user: User
    ):
        self.attempts = attempts
        self.items = items
        self.user = user

    def execute(self, data: AttemptRequest) -> AttemptModel:
        item = get_bibliography_item(self.items, data.item, user=self.user)
        others = self.attempts.list_for_item(item.id, user=self.user)
        attempt = AttemptModel(
            user=self.user,
            item=item,
            item_id=item.id,
            outcome=data.outcome,
            started_on=data.started_on,
            ended_on=data.ended_on,
            progress=data.progress,
        )
        _check_dates(attempt)
        _settle_progress(attempt, progress_given=True)
        _check_one_in_progress(attempt, others)
        return _save(self.attempts, attempt)


class UpdateAttempt:
    """Finish, abandon or re-date an Attempt (PATCH); it stays on its BibliographyItem.

    An ended Attempt is never reopened: resuming starts a new one.
    """

    def __init__(self, attempts: AttemptRepository, user: User):
        self.attempts = attempts
        self.user = user

    def execute(self, attempt_id: int, data: PatchedAttemptRequest) -> AttemptModel:
        attempt = _get_attempt(self.attempts, attempt_id, user=self.user)
        others = self.attempts.list_for_item(attempt.item_id, user=self.user)
        was_ended = not is_in_progress(attempt)
        apply_provided(data, attempt)
        _check_not_reopened(attempt, was_ended=was_ended)
        _check_dates(attempt)
        _settle_progress(attempt, progress_given='progress' in data.model_fields_set)
        _check_one_in_progress(attempt, others)
        return _save(self.attempts, attempt)
