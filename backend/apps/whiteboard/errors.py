"""Domain errors raised by the whiteboard handler layer."""


class WhiteboardError(Exception):
    """The request was understood but breaks a domain rule."""

    code: str = 'invalid'

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFound(WhiteboardError):
    """The addressed resource does not exist."""

    code = 'not_found'