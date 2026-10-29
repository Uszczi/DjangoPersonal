"""Shape use-case results as JSON-ready dicts, through the API's response contracts."""

from collections.abc import Iterable
from datetime import date as date_type
from datetime import datetime
from typing import Any

from personal.core.accounts.contracts.auth import UserResponse
from personal.core.bibliography.contracts import AttemptResponse, BibliographyItemResponse
from personal.core.counters.contracts import CounterEntryResponse, CounterResponse
from personal.core.expenses.contracts import (
    CategoryResponse,
    TransactionPageResponse,
    TransactionResponse,
    WalletResponse,
)
from personal.core.expenses.handlers import TransactionPage
from personal.core.whiteboard.contracts import FolderResponse, WhiteboardResponse
from personal.core.work.contracts import (
    ProjectResponse,
    TaskResponse,
    TimeEntryResponse,
    TimerResponse,
)
from personal.infra.models import (
    Attempt,
    BibliographyItem,
    Category,
    Counter,
    CounterEntry,
    Folder,
    Project,
    Task,
    TimeEntry,
    Transaction,
    User,
    Wallet,
    Whiteboard,
)


def project(obj: Project) -> dict[str, Any]:
    return ProjectResponse.model_validate(obj).model_dump(mode='json')


def projects(objs: Iterable[Project]) -> list[dict[str, Any]]:
    return [project(o) for o in objs]


def task(obj: Task) -> dict[str, Any]:
    return TaskResponse.model_validate(obj).model_dump(mode='json')


def tasks(objs: Iterable[Task]) -> list[dict[str, Any]]:
    return [task(o) for o in objs]


def time_entry(obj: TimeEntry) -> dict[str, Any]:
    return TimeEntryResponse.model_validate(obj).model_dump(mode='json')


def time_entries(objs: Iterable[TimeEntry]) -> list[dict[str, Any]]:
    return [time_entry(o) for o in objs]


def timer(entry: TimeEntry | None, server_now: datetime) -> dict[str, Any]:
    state = TimerResponse(
        entry=None if entry is None else TimeEntryResponse.model_validate(entry),
        server_now=server_now,
    )
    return state.model_dump(mode='json')


def account(obj: User) -> dict[str, Any]:
    return UserResponse.model_validate(obj).model_dump(mode='json')


def wallet(obj: Wallet) -> dict[str, Any]:
    return WalletResponse.model_validate(obj).model_dump(mode='json')


def wallets(objs: Iterable[Wallet]) -> list[dict[str, Any]]:
    return [wallet(o) for o in objs]


def category(obj: Category) -> dict[str, Any]:
    return CategoryResponse.model_validate(obj).model_dump(mode='json')


def categories(objs: Iterable[Category]) -> list[dict[str, Any]]:
    return [category(o) for o in objs]


def transaction(obj: Transaction) -> dict[str, Any]:
    return TransactionResponse.model_validate(obj).model_dump(mode='json')


def transactions(objs: Iterable[Transaction]) -> list[dict[str, Any]]:
    return [transaction(o) for o in objs]


def transaction_page(page: TransactionPage) -> dict[str, Any]:
    return TransactionPageResponse.model_validate(page).model_dump(mode='json')


def counter(obj: Counter) -> dict[str, Any]:
    return CounterResponse.model_validate(obj).model_dump(mode='json')


def counters(objs: Iterable[Counter]) -> list[dict[str, Any]]:
    return [counter(o) for o in objs]


def counter_entry(obj: CounterEntry) -> dict[str, Any]:
    return CounterEntryResponse.model_validate(obj).model_dump(mode='json')


def counter_entries(objs: Iterable[CounterEntry]) -> list[dict[str, Any]]:
    return [counter_entry(o) for o in objs]


def bibliography_item(obj: BibliographyItem) -> dict[str, Any]:
    return BibliographyItemResponse.model_validate(obj).model_dump(mode='json')


def bibliography_items(objs: Iterable[BibliographyItem]) -> list[dict[str, Any]]:
    return [bibliography_item(o) for o in objs]


def attempt(obj: Attempt) -> dict[str, Any]:
    return AttemptResponse.model_validate(obj).model_dump(mode='json')


def attempts(objs: Iterable[Attempt]) -> list[dict[str, Any]]:
    return [attempt(o) for o in objs]


def folder(obj: Folder) -> dict[str, Any]:
    return FolderResponse.model_validate(obj).model_dump(mode='json')


def folders(objs: Iterable[Folder]) -> list[dict[str, Any]]:
    return [folder(o) for o in objs]


def whiteboard(obj: Whiteboard) -> dict[str, Any]:
    return WhiteboardResponse.model_validate(obj).model_dump(mode='json')


def whiteboard_summaries(objs: Iterable[Whiteboard]) -> list[dict[str, Any]]:
    """Whiteboards without their ``content``: a board document can be large,
    and a listing is for finding one — ``get_whiteboard`` returns it whole."""
    return [
        WhiteboardResponse.model_validate(o).model_dump(mode='json', exclude={'content'})
        for o in objs
    ]


def parse_date(value: str | None) -> date_type | None:
    if value is None:
        return None
    return date_type.fromisoformat(value)
