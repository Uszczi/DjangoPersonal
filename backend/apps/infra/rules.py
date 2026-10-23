"""Storage-independent invariants shared by the Django and SQLAlchemy models."""

from typing import Any

DEFAULT_PROJECT_STATUSES: tuple[str, ...] = ("Todo", "Zrobione")
DEFAULT_TERMINAL_STATUS = DEFAULT_PROJECT_STATUSES[-1]
MAX_STATUSES = 20
MAX_STATUS_LENGTH = 50

INBOX_NAME = "Inbox"


def default_project_statuses() -> list[str]:
    return list(DEFAULT_PROJECT_STATUSES)


def default_board_content() -> dict[str, object]:
    return {'version': 1, 'elements': [], 'viewport': {'x': 0, 'y': 0, 'zoom': 1}}


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


def normalize_wallet_name(name: str) -> str:
    return name.strip()


def wallet_name_key(name: str) -> str:
    return normalize_wallet_name(name).casefold()


def normalize_category_name(name: str) -> str:
    return name.strip()


def category_name_key(name: str) -> str:
    return normalize_category_name(name).casefold()
