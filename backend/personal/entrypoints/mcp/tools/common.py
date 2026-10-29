"""What every tool module shares: registration, the unit of work, argument helpers."""

import functools
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from typing import Any, TypeAlias
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import anyio.to_thread
from mcp.server.fastmcp import Context
from sqlalchemy.orm import Session

from personal.infra.models import User

from .. import runtime
from ..auth import get_current_user
from ..instance import mcp

# A plain alias, not a ``type`` statement: FastMCP finds the context parameter
# by its annotation and does not see through ``TypeAliasType``.
ToolContext: TypeAlias = Context[Any, Any, Any]


def tool[**P, R](fn: Callable[P, R]) -> Callable[P, R]:
    """Register ``fn`` as a tool that runs in a worker thread.

    The wrapper keeps ``fn``'s name, docstring and signature (FastMCP builds
    the tool schema from them). ``anyio`` copies the context into the thread,
    so the OAuth token the auth middleware stored is still visible there.
    """

    @functools.wraps(fn)
    async def run(*args: P.args, **kwargs: P.kwargs) -> R:
        return await anyio.to_thread.run_sync(functools.partial(fn, *args, **kwargs))

    mcp.tool()(run)
    return fn


@contextmanager
def unit_of_work(ctx: ToolContext) -> Iterator[tuple[Session, User]]:
    """One transaction for one tool call, and the user it acts for."""
    with runtime.database.transaction() as session:
        user = get_current_user(
            ctx,
            session=session,
            tokens=runtime.tokens,
            default_user_id=runtime.default_user_id,
        )
        yield session, user


def provided(**fields: Any) -> dict[str, Any]:
    """The arguments a partial-update tool was actually given.

    An omitted tool argument arrives as ``None``; the ``Patched*`` contracts
    read an explicit ``null`` as "clear" or reject it, so ``None`` is dropped.
    """
    return {name: value for name, value in fields.items() if value is not None}


def zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError(f'Unknown time zone: {name!r}.') from None
