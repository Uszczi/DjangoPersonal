from pydantic import Field, field_validator

from personal.core.shared.base import BaseModel


class AskNotesRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)

    @field_validator('question', mode='before')
    @classmethod
    def trim_question(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError('This field may not be blank.')
        return value


class NoteSource(BaseModel):
    """A Chunk the answer cites, under the number it is cited by (``[1]``)."""

    number: int
    whiteboard_id: int
    heading: str
    text: str
    #: Cosine similarity with the question, in [-1, 1].
    score: float


class NotesAnswer(BaseModel):
    answer: str
    #: Empty when nothing in the Notatki answered the question.
    sources: list[NoteSource]
