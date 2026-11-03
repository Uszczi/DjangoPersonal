"""Views for user accounts."""

from sqlalchemy.orm import Session

from personal.infra.models import User
from personal.infra.repo import UserRepository

from .base import _RepositoryDeleteView


class UserView(_RepositoryDeleteView, model=User):
    icon = 'fa-solid fa-user'
    column_list = [User.id, User.username, User.is_active, User.is_staff, User.date_joined]
    column_searchable_list = [User.username]
    column_sortable_list = [User.id, User.username, User.date_joined]
    column_details_exclude_list = [User.password]
    form_columns = [User.is_active, User.is_staff]

    def repository(self, session: Session) -> UserRepository:
        return UserRepository(session)
