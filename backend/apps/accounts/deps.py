"""Composition root for the ``accounts`` app.

The ``PasswordHasher``, ``PasswordPolicy`` and ``TokenService`` adapters arrive
with migration stage 05; until then only the repositories are provided.
"""

from sqlalchemy.orm import Session

from apps.infra.repo import CategoryRepository, UserRepository


def user_repository(session: Session) -> UserRepository:
    return UserRepository(session)


def category_repository(session: Session) -> CategoryRepository:
    return CategoryRepository(session)
