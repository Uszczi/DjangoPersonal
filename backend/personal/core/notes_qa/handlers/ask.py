import re

from personal.core.notes_qa.contracts import AskNotesRequest, NoteSource, NotesAnswer
from personal.core.notes_qa.handlers.index import IndexNote
from personal.core.notes_qa.ports import AnswerGenerator, Embedder
from personal.core.notes_qa.prompt import NOT_FOUND, SYSTEM, Source, build_prompt
from personal.infra.models import User, Whiteboard
from personal.infra.repo import NoteChunkRepository, ScoredChunk, WhiteboardRepository

#: How many Chunks the model may read at most.
TOP_K = 5

_CITATION = re.compile(r'\[(\d+)\]')


class AskNotes:
    """Answer a question from the user's Notatki, citing the Chunks the answer comes from.

    Two guards keep it from answering out of thin air. Chunks scoring below ``min_score``
    are not shown to the model, and with none left it answers :data:`NOT_FOUND` without
    asking the model at all. A Chunk that clears the bar can still be off topic (the score
    says "close", not "contains the answer"), so the prompt tells the model to answer
    :data:`NOT_FOUND` too.
    """

    def __init__(
        self,
        whiteboards: WhiteboardRepository,
        chunks: NoteChunkRepository,
        embedder: Embedder,
        generator: AnswerGenerator,
        user: User,
        *,
        min_score: float,
        k: int = TOP_K,
    ):
        self.whiteboards = whiteboards
        self.chunks = chunks
        self.embedder = embedder
        self.generator = generator
        self.user = user
        self.min_score = min_score
        self.k = k

    def execute(self, request: AskNotesRequest) -> NotesAnswer:
        index = IndexNote(self.chunks, self.embedder, self.user)
        for whiteboard in self.whiteboards.list_all(user=self.user):
            if whiteboard.kind == Whiteboard.KIND_MARKDOWN:
                index.execute(whiteboard)

        found = self.chunks.search(
            user=self.user,
            vector=self.embedder.embed_query(request.question),
            model=self.embedder.model,
            k=self.k,
        )
        relevant = [result for result in found if result.score >= self.min_score]
        if not relevant:
            return NotesAnswer(answer=NOT_FOUND, sources=[])

        sources = [_source(number, result) for number, result in enumerate(relevant, start=1)]
        answer = self.generator.generate(
            system=SYSTEM,
            prompt=build_prompt(
                request.question,
                [Source(s.number, s.heading, s.text) for s in sources],
            ),
        ).strip()
        return NotesAnswer(answer=answer, sources=_cited(answer, sources))


def _source(number: int, result: ScoredChunk) -> NoteSource:
    return NoteSource(
        number=number,
        whiteboard_id=result.chunk.whiteboard_id,
        heading=result.chunk.heading,
        text=result.chunk.text,
        score=result.score,
    )


def _cited(answer: str, sources: list[NoteSource]) -> list[NoteSource]:
    """The sources the answer cites; all of them when it cites none (a model that forgot to
    cite still read them), and none when it found nothing."""
    if answer == NOT_FOUND:
        return []
    numbers = {int(number) for number in _CITATION.findall(answer)}
    cited = [source for source in sources if source.number in numbers]
    return cited or sources
