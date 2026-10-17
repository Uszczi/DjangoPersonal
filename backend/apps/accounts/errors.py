"""Domain errors raised by the accounts handler layer."""


class AccountsError(Exception):
    """The request was understood but breaks an accounts rule."""

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