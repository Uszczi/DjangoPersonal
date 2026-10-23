"""Storage-independent invariants of the models.

Plain functions, so the mapper events in :mod:`apps.infra.models` apply the
same rules no matter who writes a row (a repository, the seed, a factory) and
tests can exercise them without a database.
"""

import unicodedata
from datetime import UTC, datetime, time
from datetime import date as date_type
from typing import Any

from apps.infra.errors import InboxProtected

DEFAULT_PROJECT_STATUSES: tuple[str, ...] = ("Todo", "Zrobione")
DEFAULT_TERMINAL_STATUS = DEFAULT_PROJECT_STATUSES[-1]
MAX_STATUSES = 20
MAX_STATUS_LENGTH = 50

INBOX_NAME = "Inbox"
INBOX_NAME_KEY = "inbox"


def default_project_statuses() -> list[str]:
    return list(DEFAULT_PROJECT_STATUSES)


def default_board_content() -> dict[str, object]:
    return {'version': 1, 'elements': [], 'viewport': {'x': 0, 'y': 0, 'zoom': 1}}


def normalize_username(username: str) -> str:
    """Compatibility-normalize a username, so look-alike spellings collide."""
    return unicodedata.normalize('NFKC', username)


def normalize_project_statuses(statuses: Any) -> list[str]:
    """Trim, drop blanks and de-duplicate, preserving the given order.

    Returns an empty list when nothing usable remains; callers decide whether
    that means "fall back to the defaults" or "reject the payload".
    """
    if not isinstance(statuses, (list, tuple)):
        return []
    normalized: list[str] = []
    for status in statuses:
        if not isinstance(status, str):
            continue
        status = status.strip()
        if status and status not in normalized:
            normalized.append(status)
    return normalized


def consistent_statuses(statuses: Any, terminal_status: str) -> tuple[list[str], str]:
    """A project keeps at least the default statuses and a terminal status among them."""
    normalized = normalize_project_statuses(statuses) or list(DEFAULT_PROJECT_STATUSES)
    if terminal_status not in normalized:
        terminal_status = normalized[-1]
    return normalized, terminal_status


def normalize_project_name(name: str) -> str:
    return name.strip()


def project_name_key(name: str) -> str:
    return normalize_project_name(name).casefold()


def ensure_inbox_keeps_its_name(*, is_inbox: bool, name: str) -> None:
    """The Inbox is always called :data:`INBOX_NAME`; renaming it is refused."""
    if is_inbox and name != INBOX_NAME:
        raise InboxProtected('Inbox cannot be renamed.')


def ensure_not_inbox(*, is_inbox: bool) -> None:
    """The Inbox is permanent; deleting it is refused."""
    if is_inbox:
        raise InboxProtected('Inbox cannot be deleted.')


def normalize_wallet_name(name: str) -> str:
    return name.strip()


#: The colour a wallet gets when none is chosen (and the one existing wallets
#: were given when the column was added).
DEFAULT_WALLET_COLOR = '#477c7c'


def normalize_wallet_color(color: str) -> str:
    """Store ``#RRGGBB`` in lower case, so equal colours compare equal."""
    return color.strip().lower()


def wallet_name_key(name: str) -> str:
    return normalize_wallet_name(name).casefold()


#: The icon a category gets when none is chosen (and the one existing
#: categories were given when the column was added). Icons are lucide icon
#: names, which the frontend renders from ``lucide-react``.
DEFAULT_CATEGORY_ICON = 'tag'


def normalize_category_name(name: str) -> str:
    return name.strip()


def category_name_key(name: str) -> str:
    return normalize_category_name(name).casefold()


def day_start(day: date_type) -> datetime:
    """Midnight UTC on the given calendar day.

    A manual entry starts at ``day_start`` of the date it was logged for, and a
    day filter covers ``[day_start(day), day_start(day + 1))``; both sides of
    that convention live here so they cannot drift apart.
    """
    return datetime.combine(day, time.min, tzinfo=UTC)
