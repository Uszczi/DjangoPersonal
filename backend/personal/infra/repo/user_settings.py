from sqlalchemy import select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.orm import Session

from personal.infra.models import User
from personal.infra.models import UserSettings as UserSettingsModel
from personal.infra.models.user_settings import DEFAULT_THEME


class UserSettingsRepository:
    """Every database access the ``settings`` use cases need.

    The row is created on first read rather than at registration, so accounts
    made before the table existed (and users made outside ``UserRepository``)
    need no backfill.
    """

    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, *, user: User) -> UserSettingsModel:
        """``user``'s settings, created with the defaults if they have none yet.

        The insert is ``ON CONFLICT DO NOTHING``, so two first reads racing on
        different connections both end up with the one row instead of one
        failing on the primary key.
        """
        found = self.session.get(UserSettingsModel, user.id)
        if found is not None:
            return found
        insert = (
            postgresql.insert
            if self.session.get_bind().dialect.name == 'postgresql'
            else sqlite.insert
        )
        self.session.execute(
            insert(UserSettingsModel)
            .values(user_id=user.id, theme=DEFAULT_THEME)
            .on_conflict_do_nothing(index_elements=['user_id'])
        )
        query = select(UserSettingsModel).where(UserSettingsModel.user_id == user.id)
        return self.session.scalars(query).one()

    def save(self, settings: UserSettingsModel) -> UserSettingsModel:
        self.session.add(settings)
        self.session.flush()
        return settings
