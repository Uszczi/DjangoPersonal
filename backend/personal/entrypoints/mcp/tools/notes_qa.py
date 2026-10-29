"""Notes Q&A tool: answering a question from the Notatki."""

from typing import Any

from personal import wiring
from personal.core.notes_qa import handlers as notes_qa_handlers
from personal.core.notes_qa.contracts import AskNotesRequest

from .. import runtime
from .common import ToolContext, tool, unit_of_work


@tool
def ask_notes(ctx: ToolContext, question: str) -> dict[str, Any]:
    """Answer a question from the user's Notatki by meaning, not by exact words
    (``search_notatnik`` is the grep). Returns ``answer`` with citations like [1]
    and ``sources``: the cited Notatka fragments with their ``number``,
    ``whiteboard_id``, ``heading``, ``text`` and similarity ``score``. When the
    Notatki do not answer it, ``answer`` is "Nie znalazłem tego w Notatkach."
    and ``sources`` is empty."""
    with unit_of_work(ctx) as (session, user):
        handler = notes_qa_handlers.AskNotes(
            wiring.whiteboard_repository(session),
            wiring.note_chunk_repository(session),
            runtime.embedder,
            runtime.answer_generator,
            user,
            min_score=runtime.settings.notes_min_score,
        )
        return handler.execute(AskNotesRequest(question=question)).model_dump(mode='json')
