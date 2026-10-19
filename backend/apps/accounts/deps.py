"""Composition root for the ``accounts`` app."""

from apps.infra.repo import CategoryRepository, UserRepository


def user_repository() -> UserRepository:
    return UserRepository()


def category_repository() -> CategoryRepository:
    return CategoryRepository()
