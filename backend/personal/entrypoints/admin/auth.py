"""Sign-in for the admin panel: staff accounts only, kept in a signed session cookie."""

import anyio.to_thread
from sqladmin.authentication import AuthenticationBackend
from sqlalchemy.orm import Session, sessionmaker
from starlette.requests import Request

from personal.core.accounts import handlers
from personal.core.accounts.contracts.auth import LoginRequest
from personal.core.accounts.ports import PasswordHasher
from personal.core.shared.errors import DomainError
from personal.infra.repo import UserRepository

SESSION_KEY = 'admin_user_id'


class StaffAuthentication(AuthenticationBackend):
    """Checks credentials with the API's ``AuthenticateUser`` use case.

    Only active ``is_staff`` users get in, and every request re-reads the user,
    so revoking staff (or deactivating the account) ends a session at once.
    """

    def __init__(
        self, *, secret_key: str, session_maker: sessionmaker[Session], hasher: PasswordHasher
    ) -> None:
        super().__init__(secret_key=secret_key, same_site='strict', max_age=8 * 3600)
        self.session_maker = session_maker
        self.hasher = hasher

    async def login(self, request: Request) -> bool:
        form = await request.form()
        credentials = LoginRequest(
            username=str(form.get('username', '')), password=str(form.get('password', ''))
        )
        user_id = await anyio.to_thread.run_sync(self._staff_user_id, credentials)
        if user_id is None:
            return False
        request.session.clear()
        request.session[SESSION_KEY] = user_id
        return True

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        user_id = request.session.get(SESSION_KEY)
        if not isinstance(user_id, int):
            return False
        return await anyio.to_thread.run_sync(self._is_staff, user_id)

    def _staff_user_id(self, credentials: LoginRequest) -> int | None:
        with self.session_maker() as session, session.begin():
            try:
                user = handlers.AuthenticateUser(UserRepository(session), self.hasher).execute(
                    credentials
                )
            except DomainError:
                return None
            return user.id if user.is_staff else None

    def _is_staff(self, user_id: int) -> bool:
        with self.session_maker() as session:
            user = UserRepository(session).find(user_id)
            return user is not None and user.is_active and user.is_staff
