from sqlalchemy import select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.orm import Session

from personal.infra.models import User
from personal.infra.models import MobileSettings as MobileSettingsModel
from personal.infra.models.mobile_settings import default_hidden_tabs


class MobileSettingsRepository:
    """Every database access the ``mobile_settings`` use cases need.

    The row is created on first read rather than at registration, so accounts
    made before the table existed (and users made outside ``UserRepository``)
    need no backfill — exactly like :class:`UserSettingsRepository`.
    """

    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, *, user: User) -> MobileSettingsModel:
        """``user``'s mobile settings, created with the defaults if absent.

        The insert is ``ON CONFLICT DO NOTHING``, so two first reads racing on
        different connections both end up with the one row instead of one
        failing on the primary key.
        """
        found = self.session.get(MobileSettingsModel, user.id)
        if found is not None:
            return found
        insert = (
            postgresql.insert
            if self.session.get_bind().dialect.name == 'postgresql'
            else sqlite.insert
        )
        self.session.execute(
            insert(MobileSettingsModel)
            .values(user_id=user.id, hidden_tabs=default_hidden_tabs())
            .on_conflict_do_nothing(index_elements=['user_id'])
        )
        query = select(MobileSettingsModel).where(MobileSettingsModel.user_id == user.id)
        return self.session.scalars(query).one()

    def save(self, settings: MobileSettingsModel) -> MobileSettingsModel:
        self.session.add(settings)
        self.session.flush()
        return settings
