"""WhiteboardRepository."""

from sqlalchemy.orm import Session

from personal.infra.models import (
    User,
    Whiteboard,
)
from personal.infra.repo import (
    WhiteboardRepository,
)


def test_whiteboards_start_with_default_content_and_track_updates(
    session: Session, user: User
) -> None:
    boards = WhiteboardRepository(session)

    board = boards.create(user=user, name='Plan')
    created = board.updated_at
    session.expire(board)

    assert board.content == {'version': 1, 'elements': [], 'viewport': {'x': 0, 'y': 0, 'zoom': 1}}
    assert board.kind == Whiteboard.KIND_WHITEBOARD

    board.content = {'version': 1, 'elements': [{'id': 'a'}]}
    boards.save(board)
    session.expire(board)

    assert board.content['elements'] == [{'id': 'a'}]
    assert board.updated_at > created
    assert boards.list_all(user=user) == [board]
    assert boards.find(board.id, user=user) is board
    boards.delete(board)
    assert boards.find(board.id, user=user) is None
