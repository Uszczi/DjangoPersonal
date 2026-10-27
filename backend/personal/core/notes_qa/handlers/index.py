import hashlib

from personal.core.notes_qa.chunking import SplitResult, split_note
from personal.core.notes_qa.ports import Embedder
from personal.infra.models import NoteChunk, User, Whiteboard
from personal.infra.repo import NoteChunkRepository


class IndexNote:
    """Bring a Notatka's chunks in line with its content.

    Run before every question rather than on every save: the editor autosaves, and embedding
    on each keystroke pause would be wasted work. So the common case, nothing changed, costs
    one query for the stored hashes; when something did change, only chunks with a new hash
    are embedded and the others keep their vectors.
    """

    def __init__(self, chunks: NoteChunkRepository, embedder: Embedder, user: User):
        self.chunks = chunks
        self.embedder = embedder
        self.user = user

    def execute(self, note: Whiteboard) -> None:
        pieces = [_titled(note.name, piece) for piece in split_note(_markdown(note))]
        hashes = [_hash(piece) for piece in pieces]
        model = self.embedder.model
        if hashes == self.chunks.hashes_for(note, user=self.user, model=model):
            return

        known = {
            chunk.content_hash: chunk.embedding
            for chunk in self.chunks.list_for(note, user=self.user)
            if chunk.embedding_model == model
        }
        missing = {h: piece for h, piece in zip(hashes, pieces) if h not in known}
        known.update(zip(missing, self.embedder.embed_documents(list(missing.values()))))

        self.chunks.replace(
            note,
            [
                NoteChunk(
                    heading=piece.heading_path,
                    text=piece.text,
                    content_hash=h,
                    embedding_model=model,
                    embedding=known[h],
                )
                for h, piece in zip(hashes, pieces)
            ],
        )


def _markdown(note: Whiteboard) -> str:
    """A Notatka's text; empty for a drawing, so a drawing ends up with no chunks."""
    if note.kind != Whiteboard.KIND_MARKDOWN:
        return ''
    markdown = note.content.get('markdown')
    return markdown if isinstance(markdown, str) else ''


def _titled(name: str, piece: SplitResult) -> SplitResult:
    """The heading path under the Notatka's name, which is also all the title text before the
    first heading gets. A Notatka often opens with its name as a heading; that one is not
    repeated."""
    headings = piece.heading_path.split(' / ') if piece.heading_path else []
    if headings and headings[0].strip().casefold() == name.strip().casefold():
        headings = headings[1:]
    return SplitResult(heading_path=' / '.join([name, *headings]), text=piece.text)


def _hash(piece: SplitResult) -> str:
    """Of the chunk as embedded: the heading counts, so a rename re-embeds the Notatka."""
    return hashlib.sha256(f'{piece.heading_path}\n{piece.text}'.encode()).hexdigest()
