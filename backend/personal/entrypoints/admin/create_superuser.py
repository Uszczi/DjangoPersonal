"""Create a staff account for the admin panel, or promote an existing one.

``just createsuperuser <username>`` (or
``python -m personal.entrypoints.admin.create_superuser`` in the app container). A new account is registered exactly like one from the
API - password policy, Inbox, starting categories - and then marked staff. An
existing account is activated and marked staff; its password changes only
with ``--set-password``.
"""

import argparse
import getpass
import sys

from personal import wiring
from personal.core.accounts import handlers
from personal.core.accounts.contracts.auth import RegisterRequest
from personal.core.shared.errors import DomainError
from personal.infra.db import Database
from personal.infra.repo import UserRepository
from personal.settings import Settings


def _ask_password() -> str:
    password = getpass.getpass('Password: ')
    if password != getpass.getpass('Password (again): '):
        raise SystemExit('Passwords do not match.')
    return password


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else None)
    parser.add_argument('username')
    parser.add_argument(
        '--set-password', action='store_true', help='also set a new password for an existing user'
    )
    args = parser.parse_args(argv)

    settings = Settings()
    database = Database(settings)
    try:
        with database.transaction() as session:
            users = UserRepository(session)
            user = users.get_by_username(args.username)
            if user is None:
                password = _ask_password()
                handlers.RegisterUser(
                    users,
                    wiring.category_repository(session),
                    wiring.password_hasher(),
                    wiring.password_policy(),
                    wiring.token_service(settings),
                ).execute(
                    RegisterRequest(
                        username=args.username, password=password, password_confirm=password
                    )
                )
                user = users.get_by_username(args.username)
                assert user is not None
                action = 'Created'
            else:
                if args.set_password:
                    password = _ask_password()
                    problems = wiring.password_policy().problems(password, username=user.username)
                    if problems:
                        raise DomainError('; '.join(problems))
                    users.set_password_hash(user, wiring.password_hasher().hash(password))
                action = 'Promoted'
            user.is_active = True
            user.is_staff = True
    except DomainError as error:
        print(error.message, file=sys.stderr)
        return 1
    finally:
        database.dispose()
    print(f'{action} staff user {args.username!r}.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
