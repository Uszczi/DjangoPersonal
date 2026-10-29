"""Notatnik tools: folders, whiteboards and Notatki, and the grep over them."""

from typing import Any

from personal import wiring
from personal.core.whiteboard import handlers as whiteboard_handlers
from personal.core.whiteboard.contracts import (
    FolderRequest,
    PatchedFolderRequest,
    PatchedWhiteboardRequest,
    WhiteboardRequest,
)

from ..serialization import folder, folders, whiteboard, whiteboard_summaries
from .common import ToolContext, provided, tool, unit_of_work


@tool
def list_folders(ctx: ToolContext) -> list[dict[str, Any]]:
    """List Folders (``parent_id`` is null at the top level)."""
    with unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.ListFolders(wiring.folder_repository(session), user)
        return folders(handler.execute())


@tool
def create_folder(ctx: ToolContext, name: str, parent_id: int | None = None) -> dict[str, Any]:
    """Create a Folder, inside ``parent_id`` or at the top level."""
    payload = FolderRequest.model_validate({'name': name, 'parent_id': parent_id})
    with unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.CreateFolder(wiring.folder_repository(session), user)
        return folder(handler.execute(payload))


@tool
def update_folder(
    ctx: ToolContext,
    folder_id: int,
    name: str | None = None,
    parent_id: int | None = None,
    move_to_top_level: bool = False,
) -> dict[str, Any]:
    """Rename a Folder or move it into ``parent_id`` (or to the top level)."""
    fields = provided(name=name, parent_id=parent_id)
    if move_to_top_level:
        fields['parent_id'] = None
    payload = PatchedFolderRequest.model_validate(fields)
    with unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.UpdateFolder(wiring.folder_repository(session), user)
        return folder(handler.execute(folder_id, payload))


@tool
def delete_folder(ctx: ToolContext, folder_id: int) -> str:
    """Delete a Folder with its subfolders and every whiteboard and Notatka in them."""
    with unit_of_work(ctx) as (session, user):
        whiteboard_handlers.DeleteFolder(wiring.folder_repository(session), user).execute(folder_id)
        return 'deleted'


@tool
def list_whiteboards(ctx: ToolContext) -> list[dict[str, Any]]:
    """List whiteboards and Notatki (``kind`` whiteboard/markdown), without content."""
    with unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.ListWhiteboards(wiring.whiteboard_repository(session), user)
        return whiteboard_summaries(handler.execute())


@tool
def search_notatnik(ctx: ToolContext, query: str) -> list[dict[str, Any]]:
    """Grep the Notatnik: whiteboards and Notatki whose name matches ``query``,
    and Notatki whose text does, most recently changed first. Each result has
    ``lines`` — the matching lines of a Notatka with their 1-based ``number``
    (empty when only the name matched). Case and Polish diacritics are ignored;
    every word of ``query`` must appear on the same line. No content is
    returned — use ``get_whiteboard`` for the whole text."""
    with unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.SearchWhiteboards(wiring.whiteboard_repository(session), user)
        return [result.model_dump(mode='json') for result in handler.execute(query)]

@tool
def get_whiteboard(ctx: ToolContext, whiteboard_id: int) -> dict[str, Any]:
    """Fetch a whiteboard or Notatka with its content
    (a Notatka's text is ``content.markdown``)."""
    with unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.GetWhiteboard(wiring.whiteboard_repository(session), user)
        return whiteboard(handler.execute(whiteboard_id))


def _content(markdown: str | None, content: dict[str, Any] | None) -> dict[str, Any] | None:
    """``markdown`` is shorthand for a Notatka's ``{"markdown": ...}`` content."""
    if markdown is not None and content is not None:
        raise ValueError('Pass either markdown or content, not both.')
    return {'markdown': markdown} if markdown is not None else content


@tool
def create_whiteboard(
    ctx: ToolContext,
    name: str | None = None,
    kind: str = 'whiteboard',
    markdown: str | None = None,
    content: dict[str, Any] | None = None,
    folder_id: int | None = None,
) -> dict[str, Any]:
    """Create a whiteboard, or a Notatka with ``kind="markdown"`` and its text
    in ``markdown``. ``content`` is the raw document, for whiteboards."""
    payload = WhiteboardRequest.model_validate(
        {
            'kind': kind,
            'folder_id': folder_id,
            **provided(name=name, content=_content(markdown, content)),
        }
    )
    with unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.CreateWhiteboard(
            wiring.whiteboard_repository(session), wiring.folder_repository(session), user
        )
        return whiteboard(handler.execute(payload))


@tool
def update_whiteboard(
    ctx: ToolContext,
    whiteboard_id: int,
    name: str | None = None,
    markdown: str | None = None,
    content: dict[str, Any] | None = None,
    folder_id: int | None = None,
    remove_from_folder: bool = False,
) -> dict[str, Any]:
    """Update a whiteboard or Notatka (partial). ``markdown`` replaces a
    Notatka's text; ``remove_from_folder`` moves it to the top level."""
    fields = provided(name=name, content=_content(markdown, content), folder_id=folder_id)
    if remove_from_folder:
        fields['folder_id'] = None
    payload = PatchedWhiteboardRequest.model_validate(fields)
    with unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.UpdateWhiteboard(
            wiring.whiteboard_repository(session), wiring.folder_repository(session), user
        )
        return whiteboard(handler.execute(whiteboard_id, payload))


@tool
def delete_whiteboard(ctx: ToolContext, whiteboard_id: int) -> str:
    """Delete a whiteboard or Notatka."""
    with unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.DeleteWhiteboard(wiring.whiteboard_repository(session), user)
        handler.execute(whiteboard_id)
        return 'deleted'
