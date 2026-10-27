"""Questions about Notatki, answered from their Chunks."""

from fastapi import APIRouter

from personal.core.notes_qa import handlers
from personal.core.notes_qa.contracts import AskNotesRequest, NotesAnswer
from personal.entrypoints.http.deps import (
    AnswerGeneratorDep,
    CurrentUser,
    EmbedderDep,
    NoteChunkRepositoryDep,
    SettingsDep,
    WhiteboardRepositoryDep,
)

router = APIRouter(tags=['personal'])


@router.post('/notes/ask/', operation_id='notes_ask')
def ask_notes(
    payload: AskNotesRequest,
    user: CurrentUser,
    settings: SettingsDep,
    whiteboards: WhiteboardRepositoryDep,
    chunks: NoteChunkRepositoryDep,
    embedder: EmbedderDep,
    generator: AnswerGeneratorDep,
) -> NotesAnswer:
    """Answer ``question`` from the user's Notatki, with the Chunks the answer cites
    (``sources``). Nothing relevant found: the answer says so and ``sources`` is empty.
    503 when the embedding or answer model is unavailable or not configured."""
    handler = handlers.AskNotes(
        whiteboards, chunks, embedder, generator, user, min_score=settings.notes_min_score
    )
    return handler.execute(payload)
