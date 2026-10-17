"""Composition root for the ``accounts`` app."""

from apps.infra.repo import UserRepository


def user_repository() -> UserRepository:
    return UserRepository()