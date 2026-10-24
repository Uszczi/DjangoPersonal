"""Standard-library and PyJWT implementations of the accounts ports."""

import base64
import hashlib
import hmac
import secrets
import uuid
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from difflib import SequenceMatcher
from typing import Any

import jwt

from personal.core.accounts.ports import InvalidToken, TokenPair
from personal.infra.models import User

# --- Passwords -----------------------------------------------------------------


def _b64encode(raw: bytes) -> str:
    return base64.b64encode(raw).decode('ascii')


class ScryptPasswordHasher:
    """``hashlib.scrypt`` with a self-describing encoding.

    ``scrypt$<n>$<r>$<p>$<salt>$<hash>`` (salt and hash in base64) carries its
    own cost parameters, so old hashes keep verifying after the defaults are
    raised, and :meth:`needs_rehash` tells the login to upgrade them.
    """

    algorithm = 'scrypt'

    def __init__(
        self, *, n: int = 2**14, r: int = 8, p: int = 1, salt_bytes: int = 16, key_bytes: int = 64
    ) -> None:
        self.n, self.r, self.p = n, r, p
        self.salt_bytes, self.key_bytes = salt_bytes, key_bytes

    def _derive(self, password: str, salt: bytes, *, n: int, r: int, p: int, length: int) -> bytes:
        # scrypt needs ~128 * n * r bytes; leave headroom over OpenSSL's 32 MiB default.
        return hashlib.scrypt(
            password.encode(), salt=salt, n=n, r=r, p=p, dklen=length, maxmem=256 * n * r
        )

    def hash(self, password: str) -> str:
        salt = secrets.token_bytes(self.salt_bytes)
        key = self._derive(password, salt, n=self.n, r=self.r, p=self.p, length=self.key_bytes)
        return f'{self.algorithm}${self.n}${self.r}${self.p}${_b64encode(salt)}${_b64encode(key)}'

    def _parse(self, encoded: str) -> tuple[int, int, int, bytes, bytes] | None:
        parts = encoded.split('$')
        if len(parts) != 6 or parts[0] != self.algorithm:
            return None
        try:
            n, r, p = (int(part) for part in parts[1:4])
            salt, key = base64.b64decode(parts[4], validate=True), base64.b64decode(parts[5], validate=True)
        except ValueError:
            return None
        return n, r, p, salt, key

    def verify(self, password: str, encoded: str) -> bool:
        parsed = self._parse(encoded)
        if parsed is None:
            return False
        n, r, p, salt, key = parsed
        try:
            candidate = self._derive(password, salt, n=n, r=r, p=p, length=len(key))
        except ValueError:
            return False
        return hmac.compare_digest(candidate, key)

    def needs_rehash(self, encoded: str) -> bool:
        parsed = self._parse(encoded)
        if parsed is None:
            return False
        n, r, p, salt, key = parsed
        return (n, r, p, len(salt), len(key)) != (
            self.n,
            self.r,
            self.p,
            self.salt_bytes,
            self.key_bytes,
        )


#: Passwords people pick first; rejected outright. Compared case-insensitively.
COMMON_PASSWORDS = frozenset(
    {
        '123456', '123456789', '12345678', '1234567890', '12345', '1234567', 'qwerty',
        'qwerty123', 'qwertyuiop', 'password', 'password1', 'password123', 'passw0rd',
        'iloveyou', 'admin', 'admin123', 'welcome', 'welcome1', 'letmein', 'monkey',
        'dragon', 'football', 'baseball', 'sunshine', 'princess', 'abc123', 'abcd1234',
        '111111', '000000', '123123', '654321', '666666', '121212', 'superman',
        'trustno1', 'master', 'shadow', 'michael', 'starwars', 'zaq12wsx', '1q2w3e4r',
        '1qaz2wsx', 'asdfghjkl', 'zxcvbnm', 'secret', 'changeme', 'haslo', 'haslo123',
        'polska', 'zaq1@wsx', 'qazwsx', 'computer', 'internet', 'whatever',
    }
)


class SimplePasswordPolicy:
    """Minimum length, not common, not only digits, not close to the username."""

    def __init__(
        self,
        *,
        min_length: int = 8,
        common_passwords: Iterable[str] = COMMON_PASSWORDS,
        max_similarity: float = 0.7,
    ) -> None:
        self.min_length = min_length
        self.common_passwords = frozenset(word.casefold() for word in common_passwords)
        self.max_similarity = max_similarity

    def problems(self, password: str, *, username: str | None = None) -> list[str]:
        found: list[str] = []
        if username and self._similar(password, username):
            found.append('The password is too similar to the username.')
        if len(password) < self.min_length:
            found.append(
                f'This password is too short. It must contain at least {self.min_length} characters.'
            )
        if password.strip().casefold() in self.common_passwords:
            found.append('This password is too common.')
        if password.isdigit():
            found.append('This password is entirely numeric.')
        return found

    def _similar(self, password: str, username: str) -> bool:
        password, username = password.casefold(), username.casefold()
        if username in password:
            return True
        return SequenceMatcher(a=password, b=username).quick_ratio() >= self.max_similarity


# --- Tokens --------------------------------------------------------------------

ACCESS = 'access'
REFRESH = 'refresh'


class JwtTokenService:
    """HS256 JWTs: ``sub`` (user id), ``type``, ``iat``, ``exp`` and ``jti``."""

    algorithm = 'HS256'

    def __init__(
        self, *, secret_key: str, access_lifetime: timedelta, refresh_lifetime: timedelta
    ) -> None:
        self.secret_key = secret_key
        self.lifetimes = {ACCESS: access_lifetime, REFRESH: refresh_lifetime}

    def _encode(self, user_id: int, token_type: str) -> str:
        now = datetime.now(UTC)
        claims = {
            'sub': str(user_id),
            'type': token_type,
            'iat': now,
            'exp': now + self.lifetimes[token_type],
            'jti': uuid.uuid4().hex,
        }
        return jwt.encode(claims, self.secret_key, algorithm=self.algorithm)

    def _decode(self, token: str, token_type: str) -> int:
        try:
            claims: dict[str, Any] = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
                options={'require': ['sub', 'type', 'exp', 'iat', 'jti']},
            )
        except jwt.ExpiredSignatureError as error:
            raise InvalidToken('Token has expired.') from error
        except jwt.InvalidTokenError as error:
            raise InvalidToken('Token is invalid.') from error
        if claims.get('type') != token_type:
            raise InvalidToken(f'Expected an {token_type} token.')
        try:
            return int(claims['sub'])
        except ValueError as error:
            raise InvalidToken('Token is invalid.') from error

    def issue(self, user: User) -> TokenPair:
        return TokenPair(access=self._encode(user.id, ACCESS), refresh=self._encode(user.id, REFRESH))

    def refresh_access(self, refresh: str) -> str:
        return self._encode(self._decode(refresh, REFRESH), ACCESS)

    def user_id_for(self, access: str) -> int:
        return self._decode(access, ACCESS)
