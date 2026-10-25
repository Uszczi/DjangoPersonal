"""Repository tests run on the bare ``session``, as one user."""

import pytest
from sqlalchemy.orm import Session

from personal.infra.models import User
from personal.infra.repo import UserRepository


@pytest.fixture
def user(session: Session) -> User:
    return UserRepository(session).create(username='repo-user', password_hash='hash')
