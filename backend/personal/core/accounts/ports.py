from datetime import timedelta
from typing import NamedTuple, Protocol

from personal.infra.models import User


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


class RateWindow(NamedTuple):
    """How often a key was hit in its open window, and when that window closes."""

    hits: int
    #: Whole seconds until the window closes (rounded up); 0 when none is open.
    seconds_left: int


class RateLimiter(Protocol):
    """Counts hits per key over fixed windows.

    The first hit of a key opens its window; later hits do not extend it. When
    the window closes the key starts from zero. How many hits are too many is
    the use case's rule, not the adapter's. One instance serves every request
    of a process (its counts must outlive a request), so it must be
    thread-safe.
    """

    def hit(self, key: str, *, window: timedelta) -> RateWindow:
        """Count one hit for ``key``, opening a ``window``-long window if none is open.

        Returns the window including this hit, read in the same step, so
        concurrent callers each see a distinct count.
        """
        ...

    def window(self, key: str) -> RateWindow:
        """The hits of ``key``'s open window."""
        ...

    def reset(self, key: str) -> None:
        """Forget ``key``'s hits."""
        ...
