"""What the accounts use cases need from the outside world, as interfaces.

Hashing, password rules and token issuing are framework services today
(Django's auth and ``ninja_jwt``). The handlers depend on these protocols
instead, and ``apps.accounts.deps`` injects the concrete implementations from
``apps.accounts.adapters``, so the use cases never import a framework.
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

    def problems(self, password: str) -> list[str]:
        """Human-readable reasons ``password`` is rejected; empty when it is fine."""
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
