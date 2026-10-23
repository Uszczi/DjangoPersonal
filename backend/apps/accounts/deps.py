"""Composition root for the ``accounts`` app."""

from apps.infra.repo import CategoryRepository, UserRepository

from .adapters import DjangoPasswordHasher, DjangoPasswordPolicy, NinjaJWTTokenService
from .ports import PasswordHasher, PasswordPolicy, TokenService


def user_repository() -> UserRepository:
    return UserRepository()


def category_repository() -> CategoryRepository:
    return CategoryRepository()


def password_hasher() -> PasswordHasher:
    return DjangoPasswordHasher()


def password_policy() -> PasswordPolicy:
    return DjangoPasswordPolicy()


def token_service() -> TokenService:
    return NinjaJWTTokenService()
