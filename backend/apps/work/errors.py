"""Domain errors raised by the handler layer.

Handlers never know how they are reached: they signal rule violations with
these exceptions, and each transport adapter decides how to present them. The
HTTP adapter (``apps.work.api.errors``) maps :attr:`WorkError.code` onto a
status code; a future MCP server can map the same codes onto tool errors.
"""


class WorkError(Exception):
    """The request was understood but breaks a domain rule."""

    code: str = 'invalid'

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFound(WorkError):
    """The addressed resource does not exist."""

    code = 'not_found'
