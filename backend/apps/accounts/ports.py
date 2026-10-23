"""What the accounts use cases need from the outside world, as interfaces.

Hashing, password rules and token issuing are infrastructure. The handlers
depend on these protocols instead, and ``apps.accounts.deps`` injects the
concrete implementations, so the use cases never import a library for them.
"""

from typing import NamedTuple, Protocol

from apps.infra.models import User


class PasswordHasher(Protocol):
    """Encodes passwords for storage and checks attempts against them."""

    def hash(self, password: str) -> str:
        """The storable encoding of ``password``."""
        ...

    def verify(self, password: str, encoded: str) -> bool:
        """Whether ``password`` matches the stored ``encoded`` value."""
        ...

    def needs_rehash(self, encoded: str) -> bool:
        """Whether ``encoded`` uses outdated parameters and should be re-hashed."""
        ...


class PasswordPolicy(Protocol):
    """The rules a new password must satisfy."""

    def problems(self, password: str, *, username: str | None = None) -> list[str]:
        """Human-readable reasons ``password`` is rejected; empty when it is fine.

        ``username`` (when known) lets the policy reject look-alike passwords.
        """
        ...


class TokenPair(NamedTuple):
    access: str
    refresh: str


class InvalidToken(Exception):
    """A token is malformed, expired, or of the wrong type."""


class TokenService(Protocol):
    """Issues and refreshes the JWTs clients authenticate with."""

    def issue(self, user: User) -> TokenPair:
        """A fresh access/refresh pair for ``user``."""
        ...

    def refresh_access(self, refresh: str) -> str:
        """A new access token for ``refresh``, or raise :class:`InvalidToken`."""
        ...

    def user_id_for(self, access: str) -> int:
        """The id of the user an access token was issued to, or raise :class:`InvalidToken`."""
        ...
