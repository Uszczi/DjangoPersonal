"""Task title limits in the request contracts."""

import pytest
from pydantic import ValidationError

from personal.core.work.contracts.tasks import PatchedTaskUpdateRequest, TaskCreateRequest
from personal.infra.rules import MAX_TASK_TITLE_LENGTH


def test_title_may_be_up_to_the_limit() -> None:
    title = 'A' * MAX_TASK_TITLE_LENGTH
    assert TaskCreateRequest(title=title).title == title
    assert PatchedTaskUpdateRequest(title=title).title == title


def test_title_over_the_limit_is_refused() -> None:
    title = 'A' * (MAX_TASK_TITLE_LENGTH + 1)
    with pytest.raises(ValidationError):
        TaskCreateRequest(title=title)
    with pytest.raises(ValidationError):
        PatchedTaskUpdateRequest(title=title)
