import math
from dataclasses import dataclass

import numpy as np
from pgvector.sqlalchemy import VECTOR
from sqlalchemy import ColumnElement, Float, bindparam, delete, select
from sqlalchemy.orm import Session

from personal.infra.models import NoteChunk as NoteChunkModel
from personal.infra.models import User, Whiteboard


@dataclass(frozen=True)
class ScoredChunk:
    chunk: NoteChunkModel
    #: Cosine similarity with the query vector, in [-1, 1].
    score: float


class NoteChunkRepository:
    """Every database access answering questions about Notatki needs.

    :meth:`search` ranks in the database on Postgres (pgvector), so only the ``k`` best
    chunks leave it. SQLite (local dev, tests) has no vectors: there it loads the user's
    chunks and computes the same cosine in numpy.
    """

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for(self, whiteboard: Whiteboard, *, user: User) -> list[NoteChunkModel]:
        """The Notatka's chunks, in order."""
        query = (
            select(NoteChunkModel)
            .where(
                NoteChunkModel.whiteboard_id == whiteboard.id,
                NoteChunkModel.user_id == user.id,
            )
            .order_by(NoteChunkModel.position)
        )
        return list(self.session.scalars(query))

    def hashes_for(self, whiteboard: Whiteboard, *, user: User, model: str) -> list[str]:
        """The ``content_hash`` of the Notatka's chunks embedded by ``model``, in order.

        Only the hashes, not the vectors: enough to tell that a Notatka is up to date, which
        is checked for every Notatka before every question.
        """
        query = (
            select(NoteChunkModel.content_hash)
            .where(
                NoteChunkModel.whiteboard_id == whiteboard.id,
                NoteChunkModel.user_id == user.id,
                NoteChunkModel.embedding_model == model,
            )
            .order_by(NoteChunkModel.position)
        )
        return list(self.session.scalars(query))

    def replace(self, whiteboard: Whiteboard, chunks: list[NoteChunkModel]) -> None:
        """Make ``chunks`` the Notatka's only chunks, numbered in the given order."""
        self.session.execute(
            delete(NoteChunkModel).where(NoteChunkModel.whiteboard_id == whiteboard.id)
        )
        for position, chunk in enumerate(chunks):
            chunk.user_id = whiteboard.user_id
            chunk.whiteboard_id = whiteboard.id
            chunk.position = position
            self.session.add(chunk)
        self.session.flush()

    def search(
        self, *, user: User, vector: list[float], model: str, k: int
    ) -> list[ScoredChunk]:
        """The ``k`` chunks of ``user`` embedded by ``model`` closest to ``vector``, best first.

        A zero vector has no direction, so it is close to nothing.
        """
        if not any(vector):
            return []
        mine = (NoteChunkModel.user_id == user.id, NoteChunkModel.embedding_model == model)
        if self.session.get_bind().dialect.name == 'postgresql':
            return self._search_in_postgres(mine, vector, k)
        return self._search_in_memory(mine, vector, k)

    def _search_in_postgres(
        self, mine: tuple[ColumnElement[bool], ...], vector: list[float], k: int
    ) -> list[ScoredChunk]:
        # ``<=>`` is the cosine distance, 1 - cosine; NaN for a zero chunk vector, which
        # sorts last. Filtering by model first matters: vectors of different dimensions
        # make the operator fail.
        query = bindparam('query', vector, type_=VECTOR())
        distance = NoteChunkModel.embedding.op('<=>', return_type=Float)(query)
        rows = self.session.execute(
            select(NoteChunkModel, distance)
            .where(*mine)
            .order_by(distance, NoteChunkModel.id)
            .limit(k)
        )
        return [
            ScoredChunk(chunk=chunk, score=0.0 if math.isnan(d) else 1.0 - d)
            for chunk, d in rows
        ]

    def _search_in_memory(
        self, mine: tuple[ColumnElement[bool], ...], vector: list[float], k: int
    ) -> list[ScoredChunk]:
        candidates = list(
            self.session.scalars(select(NoteChunkModel).where(*mine).order_by(NoteChunkModel.id))
        )
        if not candidates:
            return []
        query_vector = np.asarray(vector, dtype=np.float64)
        matrix = np.asarray([chunk.embedding for chunk in candidates], dtype=np.float64)
        norms = np.linalg.norm(matrix, axis=1)
        norms[norms == 0] = np.inf
        scores = matrix @ query_vector / (norms * np.linalg.norm(query_vector))
        best = np.argsort(-scores, kind='stable')[:k]
        return [ScoredChunk(chunk=candidates[i], score=float(scores[i])) for i in best]
