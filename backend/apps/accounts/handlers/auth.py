"""Authentication use cases."""

from apps.accounts.contracts.auth import (
    AuthResponse,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
)
from apps.accounts.ports import InvalidToken, PasswordHasher, PasswordPolicy, TokenService
from apps.expenses.handlers.categories import seed_base_categories
from apps.infra.models import User
from apps.infra.repo import CategoryRepository, DuplicateUsername, UserRepository
from apps.shared.errors import DomainError


class RegisterUser:
    """Register a new user and issue a token pair.

    A fresh account also receives the expenses base categories (and the System
    category), so the expense book is ready the moment the first wallet
    appears. The caller's transaction (one request) covers both, so a user
    never exists without their starting categories.
    """

    def __init__(
        self,
        users: UserRepository,
        categories: CategoryRepository,
        hasher: PasswordHasher,
        policy: PasswordPolicy,
        tokens: TokenService,
    ):
        self.users = users
        self.categories = categories
        self.hasher = hasher
        self.policy = policy
        self.tokens = tokens

    def execute(self, data: RegisterRequest) -> AuthResponse:
        if data.password != data.password_confirm:
            raise DomainError('Passwords do not match.', status=400)

        problems = self.policy.problems(data.password, username=data.username)
        if problems:
            raise DomainError('; '.join(problems), status=400)

        try:
            user = self.users.create(
                username=data.username, password_hash=self.hasher.hash(data.password)
            )
        except DuplicateUsername as error:
            raise DomainError('A user with this username already exists.', status=400) from error
        seed_base_categories(self.categories, user)

        tokens = self.tokens.issue(user)
        return AuthResponse(access=tokens.access, refresh=tokens.refresh)


class LoginUser:
    """Authenticate a user and issue a token pair.

    Inactive users cannot log in, an unknown
    username still pays for one hash (so response time does not reveal which
    usernames exist), and a hash with outdated parameters is upgraded on a
    successful login.
    """

    def __init__(self, users: UserRepository, hasher: PasswordHasher, tokens: TokenService):
        self.users = users
        self.hasher = hasher
        self.tokens = tokens

    def execute(self, data: LoginRequest) -> LoginResponse:
        user = self.users.get_by_username(data.username)
        if user is None:
            self.hasher.hash(data.password)
            raise DomainError('Invalid username or password.', status=401)
        if not self.hasher.verify(data.password, user.password) or not user.is_active:
            raise DomainError('Invalid username or password.', status=401)

        if self.hasher.needs_rehash(user.password):
            self.users.set_password_hash(user, self.hasher.hash(data.password))

        tokens = self.tokens.issue(user)
        return LoginResponse(access=tokens.access, refresh=tokens.refresh)


class DeleteUser:
    """Delete the authenticated account and all of its data."""

    def __init__(self, users: UserRepository):
        self.users = users

    def execute(self, user: User) -> None:
        self.users.delete(user)


class RefreshAccessToken:
    """Exchange a refresh token for a new access token."""

    def __init__(self, tokens: TokenService):
        self.tokens = tokens

    def execute(self, data: RefreshRequest) -> RefreshResponse:
        try:
            access = self.tokens.refresh_access(data.refresh)
        except InvalidToken as error:
            raise DomainError('Invalid or expired refresh token.', status=401) from error
        return RefreshResponse(access=access)
