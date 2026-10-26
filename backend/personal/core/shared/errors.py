"""Domain errors raised by the handler layer.

Handlers never know how they are reached: they signal rule violations with
these exceptions, and each transport adapter decides how to present them. The
HTTP adapter (``personal.entrypoints.http.errors``) maps :attr:`DomainError.code`
onto a status code, giving an explicit :attr:`DomainError.status` precedence; the
MCP toolserver can map the same codes onto tool errors later.
"""


class DomainError(Exception):
    """The request was understood but breaks a domain rule."""

    code: str = 'invalid'

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        status: int | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        self.status = status


class NotFound(DomainError):
    """The addressed resource does not exist."""

    code = 'not_found'


class RateLimited(DomainError):
    """Too many attempts; the caller may try again after :attr:`retry_after` seconds."""

    code = 'rate_limited'

    def __init__(self, message: str, *, retry_after: int) -> None:
        super().__init__(message)
        self.retry_after = retry_after
